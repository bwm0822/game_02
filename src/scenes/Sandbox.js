import { GameScene } from './GameScene.js'
import { loadData } from './MainMenu.js'
import Map from '../manager/map.js'
import Record from '../infra/record.js'
import TimeSystem from '../systems/time.js'
import Utility from '../core/utility.js'
import {GameObject} from '../core/gameobject.js'
import {GM, GS} from '../core/setting.js'
import Puppet from '../roles/puppet.js'
import DB from '../data/db.js'
import {playParticle} from '../core/particle.js'

// 開發版的 gym 場景：工具殼「場景」分頁的 iframe 跑 /?sandbox，用 postMessage 操作（訊息帶 sb 欄位，見 docs/scene-tool.md）
// 繼承 GameScene 拿真的地圖／路網／Light2D，但沒有玩家、UI、回合、作息、劇情；地圖只建地形＋靜態物件，不寫存檔
const ZOOM = [0.25, 8];
const GRID_DEPTH = 1e7;
const HANDLE = 6;   // 擺設大小把手（螢幕 px）
const DEFAULT_TIME = '08:00';   // 同 Record.game_def 的開局時間

let dataLoaded = false;
const cams = {};    // 地圖 → 鏡頭 {x, y, zoom}，重載同一張圖時接著看

export class Sandbox extends GameScene
{
    constructor()
    {
        super('Sandbox');
    }

    get sandbox() {return true;}

    init(data)
    {
        super.init({...data, map:data?.map ?? 'sandbox'});
    }

    update() {this._syncLights(); this._drawSel();}

    async create()
    {
        if(!dataLoaded) {dataLoaded = true; loadData(this);}
        Record.noSave = true;
        Record.game = Utility.deepClone(Record.game_def);
        GS.mode = GM.MODE.NORMAL;
        GM.w = this.scale.width;
        GM.h = this.scale.height;

        this.roles = [];
        this.gos = {};
        this.named = {};
        GameObject.gid = 0;
        TimeSystem.load();
        TimeSystem.register(()=>this._ambient());   // 排第一個：燈（com_lamp／com_light）照環境光算亮度，要先換好
        this.lights.enable();
        this._sceneTime = null;
        this._amb = null;
        this._ambient();
        this.cameras.main.setBackgroundColor('#202226');

        this._onMsg = (e)=>{if(e.source===window.parent && e.data?.sb) {this._recv(e.data);}};
        addEventListener('message', this._onMsg);
        this.events.once('shutdown', ()=>removeEventListener('message', this._onMsg));
        this.scale.on('resize', this._onResize, this);
        this.events.once('shutdown', ()=>this.scale.off('resize', this._onResize, this));

        try {await new Map(this).createMap(this.mapName, true);}
        catch(e) {this._send({sb:'error', msg:`地圖 ${this.mapName} 載入失敗：${e.message}`}); return;}

        this._initCam();
        this._grid = this.add.graphics().setDepth(GRID_DEPTH);
        this._selG = this.add.graphics().setDepth(GRID_DEPTH+1);
        this._gridOn = this._data.grid ?? true;
        this._sel = this._data.sel ?? null;
        this._hidden = new Set(this._data.hidden);
        this._props = {};
        this._drawGrid();
        this._initInput();
        if(import.meta.env.DEV) {window.__sb = this;}
        if(this._data.scene) {this._apply(this._data.scene);}
        else {this._send({sb:'ready', map:this.mapName});}
    }

    // 場景分頁送來的場景（tools/scenes.json 的一筆）；換底圖要整個重開
    // 角色照 key 比對：資料一樣的留著（表演到一半不打斷），不一樣或 force（重置）就重建
    async _apply(scene, {force=false}={})
    {
        this._scene = scene;
        // 重置：表演生出來的東西（火牆區域、屍體…）一起清掉；地圖本身的物件 uid 不是 -1
        if(force) {Object.values(this.gos).filter(g=>g.uid===-1 && g.active).forEach(g=>g._remove());}
        const want = Object.fromEntries((scene.roles ?? []).map(r=>[r.key, r]));
        for(const p of [...this.roles])
        {
            if(force || !want[p.key] || Sandbox._sig(want[p.key])!==p._sig) {p.dismiss();}
        }
        const bad = [];
        for(const r of scene.roles ?? [])
        {
            const p = this._puppet(r.key) ?? this._spawn(r);
            if(!p) {bad.push(r.id); continue;}
            this._syncFx(p, r.fx ?? []);
        }
        if(bad.length) {this._send({sb:'error', msg:`role.json 沒有：${[...new Set(bad)].join('、')}`});}
        this._amb = scene.ambient ?? null;
        // 時間只在場景檔的值變了才跳過去（▶ 播放中編輯別的東西不會被拉回去）
        const t = scene.time ?? DEFAULT_TIME;
        if(force || t!==this._sceneTime) {this._sceneTime = t; this._setTime(t);}
        else {this._ambient();}
        await this._applyProps(scene.props ?? []);
        if(this._scene!==scene) {return;}   // 載外部圖的期間又來了新的場景
        // 粒子、光源可以跟著擺設：擺設建好（sprite 換新）才套
        this._applyEmitters(scene.particles ?? [], force);
        this._applyLights(scene.lights ?? [], force);
        this._send({sb:'loaded', map:this.mapName, w:this.map.map.width, h:this.map.map.height});
    }

    //------------------------------------------------------
    //  擺設：{key, img, x, y（錨點的世界座標）, sx, sy, pct, flip, angle, ox, oy, depth（加在 y 上）}
    //  img＝textures 的 key（可帶 :frame）或 file:<相對專案的路徑>（還沒放進 textures/ 的圖，vite 直接給）
    //  pct＝file: 圖要烤成原圖的幾 %（工具「存檔…」用），這裡直接乘進 scale 模擬，不真的縮圖
    //------------------------------------------------------
    async _applyProps(list)
    {
        const want = Object.fromEntries(list.map(p=>[p.key, p]));
        for(const [k, o] of Object.entries(this._props))
        {
            if(JSON.stringify(want[k])!==o.sig) {this._dropProp(k);}
        }
        const bad = [];
        for(const p of list)
        {
            if(this._props[p.key]) {continue;}
            const tex = await this._tex(p.img);
            if(!tex) {bad.push(p.img); continue;}
            if(this._props[p.key] || JSON.stringify(want[p.key])!==JSON.stringify(p)) {continue;}
            this._props[p.key] = this._makeProp(p, tex);
        }
        if(bad.length) {this._send({sb:'error', msg:`載不到圖：${[...new Set(bad)].join('、')}`});}
    }

    // 回傳 [key, frame]；外部圖第一次用到才載
    async _tex(img)
    {
        if(!img) {return null;}
        if(!img.startsWith('file:'))
        {
            const [key, frame] = img.split(':');
            return this.textures.exists(key) ? [key, frame] : null;
        }
        if(!this.textures.exists(img))
        {
            await new Promise((res)=>{
                // vite：public/ 底下的檔在網址根目錄，其他照專案路徑；要完整網址，不然 loader 會接在 setPath('assets') 後面
                this.load.image(img, `${location.origin}/${img.slice(5).replace(/^public\//, '').split('/').map(encodeURIComponent).join('/')}`);
                this.load.once('complete', res);
                this.load.start();
            });
        }
        return this.textures.exists(img) ? [img] : null;
    }

    _makeProp(p, [key, frame])
    {
        const k = p.img.startsWith('file:') ? (p.pct ?? 100) / 100 : 1;
        const sp = this.add.image(p.x, p.y, key, frame)
            .setOrigin(p.ox ?? 0.5, p.oy ?? 1).setScale(k * (p.sx ?? 1), k * (p.sy ?? 1)).setFlipX(!!p.flip).setAngle(p.angle ?? 0)
            .setDepth(p.y + (p.depth ?? 0)).setPipeline('Light2D').setVisible(!this._hidden.has(p.key));
        return {sp, data:p, sig:JSON.stringify(p)};
    }

    _dropProp(k)
    {
        this._props[k].sp.destroy();
        delete this._props[k];
    }

    // 拖曳中：深度照新的 y（跟著它的光源每幀在 update 跟上、粒子跟著 sprite）
    _placeProp(o, x, y)
    {
        o.sp.setPosition(x, y).setDepth(y + (o.data.depth ?? 0));
    }

    // follow 的對象：角色（root＝站的點）或擺設（sprite＝錨點）
    _target(key) {return key ? this._puppet(key) ?? this._props[key]?.sp ?? null : null;}

    _spawn(r)
    {
        const pt = this.map.tileToWorld(r.tx, r.ty);
        const p = new Puppet(this, pt.x, pt.y);
        if(!p.init_runtime(r)) {p.destroy(); return null;}
        p._sig = Sandbox._sig(r);
        p._fx = [];
        p.setVisible(!this._hidden.has(r.key));
        return p;
    }

    _puppet(key) {return this.roles.find(p=>p.key===key);}

    //------------------------------------------------------
    //  日夜：時鐘是真的 TimeSystem（環境光照 GameScene 的 lutAmbient、燈的亮度跟著），scene.ambient（'#rrggbb'）蓋掉 LUT
    //------------------------------------------------------
    _setTime(t)
    {
        const [h, m] = t.split(':').map(Number);
        TimeSystem.time = {d:0, h, m};
        TimeSystem.ticks = TimeSystem.time2Ticks(TimeSystem.time);
        TimeSystem.emit(0);
    }

    _ambient()
    {
        const c = this._amb ? Phaser.Display.Color.HexStringToColor(this._amb).color : this.getAmbientColor(TimeSystem.time);
        this.lights.setAmbientColor(c);
        Object.values(this._lights ?? {}).forEach(o=>this._lightI(o));
        const ai = Math.round(this._autoI()*100)/100;
        if(ai!==this._lastAutoI) {this._lastAutoI = ai; this._send({sb:'autoI', v:ai});}
    }

    static _hhmm({h, m}) {return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;}

    // ▶：speed＝每秒走幾分鐘遊戲時間（0＝停），每 100ms 推一次、回報給分頁
    _play(speed)
    {
        this._clock?.remove();
        this._clock = null;
        if(!speed) {return;}
        let acc = 0;
        this._clock = this.time.addEvent({delay:100, loop:true, callback:()=>{
            acc += speed/10;
            const n = Math.floor(acc);
            if(!n) {return;}
            acc -= n;
            const total = (TimeSystem.time.h*60 + TimeSystem.time.m + n) % 1440;
            this._setTime(Sandbox._hhmm({h:Math.floor(total/60), m:total%60}));
            this._send({sb:'time', t:Sandbox._hhmm(TimeSystem.time)});
        }});
    }

    // 角色資料的比對不含 fx（狀態特效另外加減，不用重建角色）
    static _sig({fx, ...r}) {return JSON.stringify(r);}

    // 狀態特效（fx.json 的 id）：新的 fxOn、拿掉的 fxOff（播 end）；走 com_disp，同遊戲
    _syncFx(p, ids)
    {
        if(!p.isAlive) {return;}
        for(const id of p._fx.filter(id=>!ids.includes(id))) {p.fxOff?.(id);}
        for(const id of ids.filter(id=>!p._fx.includes(id)))
        {
            if(!DB.fx(id)) {this._send({sb:'error', msg:`fx.json 沒有 ${id}`});}
            p.fxOn?.(id);
        }
        p._fx = [...ids];
    }

    //------------------------------------------------------
    //  粒子發射點：{key, id（particle.json）, x, y, follow?（角色／擺設 key：x/y 變成相對它）, every?（burst 幾 ms 噴一次）}
    //  畫面上畫一個橘色菱形讓它點得到、拖得動（只在 sandbox 裡，不是遊戲的東西）
    //------------------------------------------------------
    _applyEmitters(list, force)
    {
        this._emitters ??= {};
        const want = Object.fromEntries(list.map(e=>[e.key, e]));
        for(const [k, o] of Object.entries(this._emitters))
        {
            const e = want[k];
            if(force || JSON.stringify(e)!==o.sig || (e.follow && this._target(e.follow)!==o.target)) {this._dropEmitter(k);}
        }
        const bad = [];
        for(const e of list)
        {
            if(this._emitters[e.key]) {continue;}
            const def = DB.particle(e.id);
            if(!def) {bad.push(e.id);}
            this._emitters[e.key] = {data:e, sig:JSON.stringify(e), def, target:this._target(e.follow)};
            this._emit(this._emitters[e.key]);
        }
        if(bad.length) {this._send({sb:'error', msg:`particle.json 沒有：${[...new Set(bad)].join('、')}`});}
    }

    _emitPos(o)
    {
        const t = o.target?.active ? o.target : null;
        return {x:(t?.x ?? 0) + o.data.x, y:(t?.y ?? 0) + o.data.y};
    }

    _emit(o)
    {
        if(!o.def) {return;}
        this._emitOnce(o);
        if(o.def.mode==='burst' && !o.timer)
        {
            o.timer = this.time.addEvent({delay:o.data.every ?? 1000, loop:true, callback:()=>{o.timer && this._emitOnce(o);}});
        }
    }

    _emitOnce(o)
    {
        const opts = o.target?.active ? {target:o.target, ox:o.data.x, oy:o.data.y} : this._emitPos(o);
        o.fx = playParticle(this, o.def, opts);
        o.fx?.emitter?.setVisible(!this._hidden.has(o.data.key));
    }

    _dropEmitter(k)
    {
        const o = this._emitters[k];
        o.timer?.remove();
        o.fx?.stop(true);
        delete this._emitters[k];
    }

    _emitterAt(wx, wy)
    {
        const r = 8/this.cameras.main.zoom;
        return Object.entries(this._emitters ?? {}).find(([k, o])=>{
            if(!this._markOn('particle', k)) {return false;}
            const p = this._emitPos(o);
            return Math.abs(p.x-wx)<=r && Math.abs(p.y-wy)<=r;
        });
    }

    // 拖曳中：stream 的發射點直接搬，burst 下次噴就在新位置
    _placeEmitter(o, x, y)
    {
        const t = o.target?.active ? o.target : null;
        o.data = {...o.data, x:x-(t?.x ?? 0), y:y-(t?.y ?? 0)};
        const em = o.fx?.emitter;
        if(em?.active)
        {
            if(t) {em.followOffset?.set(o.data.x, o.data.y);}
            else {em.setPosition(x, y);}
        }
    }

    //------------------------------------------------------
    //  光源：{key, x, y, r, color（'#rrggbb'）, i?（沒寫＝照遊戲 GM.LIGHT－環境光，同 com_lamp）, follow?（角色／擺設 key：x/y 變成相對它）}
    //  畫面上畫一個光色圓點讓它點得到、拖得動；選中時虛線圈＝半徑、圈上的把手拖 r
    //------------------------------------------------------
    _applyLights(list, force)
    {
        this._lights ??= {};
        const want = Object.fromEntries(list.map(l=>[l.key, l]));
        for(const [k, o] of Object.entries(this._lights))
        {
            const l = want[k];
            if(force || JSON.stringify(l)!==o.sig || (l.follow && this._target(l.follow)!==o.target)) {this._dropLight(k);}
        }
        for(const l of list)
        {
            if(this._lights[l.key]) {continue;}
            const o = {data:l, sig:JSON.stringify(l), target:this._target(l.follow), hex:Phaser.Display.Color.HexStringToColor(l.color ?? '#ffcc88').color};
            const {x, y} = this._lightPos(o);
            o.light = this.lights.addLight(x, y, l.r ?? 120, o.hex, 0);
            this._lights[l.key] = o;
            this._lightI(o);
        }
    }

    _lightPos(o)
    {
        const t = o.target?.active ? o.target : null;
        return {x:(t?.x ?? 0) + o.data.x, y:(t?.y ?? 0) + o.data.y};
    }

    // 亮度：藏著＝0、有寫 i 用它、沒寫照遊戲公式（環境光一換就重算）
    _lightI(o)
    {
        o.light.intensity = this._hidden.has(o.data.key) ? 0 : o.data.i ?? this._autoI();
    }

    _autoI() {return Math.max(0, GM.LIGHT - this.lights.ambientColor.r);}

    _dropLight(k)
    {
        this.lights.removeLight(this._lights[k].light);
        delete this._lights[k];
    }

    _lightAt(wx, wy)
    {
        const r = 8/this.cameras.main.zoom;
        return Object.entries(this._lights ?? {}).find(([k, o])=>{
            if(!this._markOn('light', k)) {return false;}
            const p = this._lightPos(o);
            return Math.abs(p.x-wx)<=r && Math.abs(p.y-wy)<=r;
        });
    }

    _placeLight(o, x, y)
    {
        const t = o.target?.active ? o.target : null;
        o.data = {...o.data, x:x-(t?.x ?? 0), y:y-(t?.y ?? 0)};
        o.light.setPosition(x, y);
    }

    // 記號畫不畫、點不點得到：👁 藏著＝不；工具列「光源記號／粒子記號」沒勾＝只有選中的那個
    _markOn(kind, k)
    {
        return !this._hidden.has(k) && (this._icons?.[kind] !== false || k===this._sel);
    }

    // 選中光源的半徑把手（圈的右邊）
    _radiusHandle()
    {
        const o = this._lights?.[this._sel];
        if(!o || this._hidden.has(this._sel)) {return null;}
        const p = this._lightPos(o);
        return {o, x:p.x + o.light.radius, y:p.y};
    }

    _radiusAt(wx, wy)
    {
        const rh = this._radiusHandle(), s = (HANDLE/2 + 2)/this.cameras.main.zoom;
        return rh && Math.abs(rh.x-wx)<=s && Math.abs(rh.y-wy)<=s ? rh : null;
    }

    // 拖半徑把手：r＝游標到圓心的距離（整數、最少 1；Shift 吸 16 的倍數）
    _radiusTo(d, wx, wy, snap)
    {
        const c = this._lightPos(d.radius), dist = Math.hypot(wx-c.x, wy-c.y);
        d.r = Math.max(1, snap ? Math.round(dist/16)*16 : Math.round(dist));
        d.radius.light.setRadius(d.r);
    }

    // 跟著東西的光每幀跟上
    _syncLights()
    {
        for(const o of Object.values(this._lights ?? {}))
        {
            if(o.target) {const p = this._lightPos(o); o.light.setPosition(p.x, p.y);}
        }
    }

    //------------------------------------------------------
    //  表演（不改場景檔，「重置」回到場景檔的樣子）
    //  act = {key（誰做）, kind:'attack'|'ability'|'walk', id（技能）, tx, ty（目標格子）, tkey?（點到的角色）}
    //------------------------------------------------------
    async _do(act)
    {
        const p = this._puppet(act?.key);
        if(!p?.active || !p.isAlive) {return;}
        if(p._busy) {this._send({sb:'error', msg:`${p.id} 還在動`}); return;}
        this._last = act;
        const pt = this.map.tileToWorld(act.tx, act.ty);
        const t = this._puppet(act.tkey);
        const target = t?.active && t!==p && t.isAlive ? t : null;
        p._busy = true;
        try
        {
            if(act.kind==='walk') {await this._walk(p, pt);}
            else if(act.kind==='attack')
            {
                if(target) {await p.attack([target], null);}
                else {await p.anim_melee({pos:pt});}
            }
            else
            {
                // 忽略射程：range 放大到整張地圖（遮擋照算）
                const ab = DB.ability(act.id);
                if(!ab) {this._send({sb:'error', msg:`ability.json 沒有 ${act.id}`}); return;}
                if(!p.canUseAb(act.id)) {this._send({sb:'error', msg:`${act.id} 要拿 ${ab.reqClass} 類的武器`}); return;}
                const range = Math.max(this.map.map.width, this.map.map.height);
                const ok = await p.useAb(target ?? (ab.tag===GM.HEAL ? p : null), act.id, pt, {...ab, range});
                if(!ok) {this._send({sb:'error', msg:`${act.id} 放不出來（目標無效？單體技能要點角色）`});}
            }
        }
        finally
        {
            p._busy = false;
            if(p.active) {p.updateDepth();}
        }
    }

    async _walk(p, pt)
    {
        p.findPath({ep:pt});
        if(!(p.bb.path?.state>GM.PATH_NONE)) {this._send({sb:'error', msg:'走不到那裡'}); p.clearPath?.(); return;}
        for(let i=0; i<999 && p.active && p.bb.path; i++)
        {
            await p.move();
            if(p.bb.cACT.st!=='moving') {break;}
        }
        p.clearPath?.();
    }

    // 點到的角色：身體方塊包住游標的、最上面那個；都沒有就看站在那格的
    _roleAt(wx, wy)
    {
        const hits = this.roles.filter(p=>p.visible && p.getShapeRect?.().contains(wx, wy));
        if(hits.length) {return hits.reduce((a, b)=>(b.depth>a.depth ? b : a));}
        const [tx, ty] = this.map.worldToTile(wx, wy);
        return this.roles.find(p=>p.visible && this.map.worldToTile(p.x, p.y).every((v, i)=>v===[tx, ty][i]));
    }

    // 點到的東西（角色或擺設，最上面那個）：{key, role?, prop?}
    _pickAt(wx, wy)
    {
        const em = this._emitterAt(wx, wy);   // 發射點、光源的記號畫在最上面
        if(em) {return {key:em[0], emitter:em[1]};}
        const li = this._lightAt(wx, wy);
        if(li) {return {key:li[0], light:li[1]};}
        const hits = [
            ...this.roles.filter(p=>p.visible && p.getShapeRect?.().contains(wx, wy)).map(role=>({key:role.key, role, depth:role.depth})),
            ...Object.entries(this._props).filter(([, o])=>o.sp.visible && o.sp.getBounds().contains(wx, wy)).map(([key, prop])=>({key, prop, depth:prop.sp.depth})),
        ];
        if(hits.length) {return hits.reduce((a, b)=>(b.depth>a.depth ? b : a));}
        const role = this._roleAt(wx, wy);
        return role ? {key:role.key, role} : null;
    }

    _drawSel()
    {
        const g = this._selG;
        if(!g) {return;}
        g.clear();
        const z = this.cameras.main.zoom;
        if(this._arm)
        {
            const ptr = this.input.activePointer;
            const [tx, ty] = this.map.worldToTile(ptr.worldX, ptr.worldY);
            if(this.map.isInside(tx, ty)) {g.lineStyle(2/z, 0xff9933, 1).strokeRect(tx*GM.TILE_W, ty*GM.TILE_H, GM.TILE_W, GM.TILE_H);}
        }
        for(const [k, e] of Object.entries(this._emitters ?? {}))
        {
            if(!this._markOn('particle', k)) {continue;}
            const {x, y} = this._emitPos(e), s = 6/z;
            g.lineStyle(2/z, k===this._sel ? 0x7ddc5a : 0xff9933, 1).fillStyle(0x000000, 0.4)
                .fillPoints([{x, y:y-s}, {x:x+s, y}, {x, y:y+s}, {x:x-s, y}], true).strokePoints([{x, y:y-s}, {x:x+s, y}, {x, y:y+s}, {x:x-s, y}], true);
        }
        for(const [k, o] of Object.entries(this._lights ?? {}))
        {
            if(!this._markOn('light', k)) {continue;}
            const {x, y} = this._lightPos(o), s = 6/z, sel = k===this._sel;
            g.fillStyle(o.hex, 1).fillCircle(x, y, s)
                .lineStyle((sel ? 2 : 1.5)/z, sel ? 0x7ddc5a : 0x000000, 1).strokeCircle(x, y, s);
            if(sel)
            {
                // 虛線圈＝半徑
                const R = o.light.radius, n = 64;
                g.lineStyle(1.5/z, 0x7ddc5a, 0.9);
                for(let i=0; i<n; i+=2) {g.beginPath().arc(x, y, R, i/n*Math.PI*2, (i+1)/n*Math.PI*2).strokePath();}
            }
        }
        const rh = this._radiusHandle();
        if(rh) {const s = HANDLE/z; g.fillStyle(0xffffff, 1).fillRect(rh.x-s/2, rh.y-s/2, s, s).lineStyle(1/z, 0x3a8a2a, 1).strokeRect(rh.x-s/2, rh.y-s/2, s, s);}
        const p = this._puppet(this._sel), o = this._props?.[this._sel];
        const r = p?.visible && p.getShapeRect ? p.getShapeRect() : o?.sp.visible ? o.sp.getBounds() : null;
        if(!r) {return;}
        g.lineStyle(2/z, 0x7ddc5a, 1).strokeRect(r.x, r.y, r.width, r.height);
        const s = HANDLE/z;
        for(const hd of this._handles()) {g.fillStyle(0xffffff, 1).fillRect(hd.x-s/2, hd.y-s/2, s, s).lineStyle(1/z, 0x3a8a2a, 1).strokeRect(hd.x-s/2, hd.y-s/2, s, s);}
        const a = this._anchorPt();
        if(a)
        {
            // 黃點黑框＋十字：錨點常壓在綠框下邊上，要跟框線分得開
            const ar = 4/z, c = ar*0.6;
            g.fillStyle(0xffdd33, 1).fillCircle(a.x, a.y, ar).lineStyle(1.5/z, 0x000000, 1).strokeCircle(a.x, a.y, ar)
                .lineStyle(1/z, 0x000000, 1).lineBetween(a.x-c, a.y, a.x+c, a.y).lineBetween(a.x, a.y-c, a.x, a.y+c);
        }
    }

    // 選中的擺設（sprite 的 x/y）或角色（root 的 x/y＝套用 role.anchor 後站的點）；工具列「錨點」沒勾＝null
    _anchorPt()
    {
        if(this._anchorOn===false) {return null;}
        const o = this._props?.[this._sel], p = this._puppet(this._sel);
        if(o?.sp.visible) {return {x:o.sp.x, y:o.sp.y};}
        if(p?.visible) {return {x:p.x, y:p.y};}
        return null;
    }

    //------------------------------------------------------
    //  擺設大小把手：選中的擺設綠框上 4 角＋4 邊中點（有角度不出），對邊固定；
    //  改 sx/sy 或 pct 照分頁的鎖（_size.lock，file 圖才有 pct），等比＝_size.ratio（pct 一定等比）
    //------------------------------------------------------
    _handles()
    {
        const o = this._props?.[this._sel];
        if(!o?.sp.visible || (o.data.angle ?? 0)!==0) {return [];}
        const r = o.sp.getBounds(), out = [];
        for(const hy of [-1, 0, 1]) {for(const hx of [-1, 0, 1])
        {
            if(hx || hy) {out.push({hx, hy, x:r.x + (hx+1)/2*r.width, y:r.y + (hy+1)/2*r.height});}
        }}
        return out;
    }

    _handleAt(wx, wy)
    {
        const s = (HANDLE/2 + 2)/this.cameras.main.zoom;
        return this._handles().find(hd=>Math.abs(hd.x-wx)<=s && Math.abs(hd.y-wy)<=s) ?? null;
    }

    _startResize(hd)
    {
        const o = this._props[this._sel];
        this._drag = {resize:true, prop:o, key:this._sel, hx:hd.hx, hy:hd.hy, r0:o.sp.getBounds(),
                      pct:this._size?.lock==='scale' && o.data.img.startsWith('file:'), ratio:this._size?.ratio ?? true, patch:null};
    }

    _resizeTo(d, wx, wy, snap)
    {
        const o = d.prop, r = d.r0, w0 = r.width, h0 = r.height;
        const pctMode = d.pct;
        const uni = pctMode || d.ratio;
        const sn = (v)=>(snap ? Math.round(v/16)*16 : v);
        let [x0, x1, y0, y1] = [r.left, r.right, r.top, r.bottom];
        if(d.hx<0) {x0 = Math.min(sn(wx), x1-1);}
        if(d.hx>0) {x1 = Math.max(sn(wx), x0+1);}
        if(d.hy<0) {y0 = Math.min(sn(wy), y1-1);}
        if(d.hy>0) {y1 = Math.max(sn(wy), y0+1);}
        let fx = (x1-x0)/w0, fy = (y1-y0)/h0;
        const {ox = 0.5, oy = 1} = o.data;
        if(uni)
        {
            // 角＝照拖得多的那軸；邊＝那軸；另一軸照比例、拉角時對邊固定、拉邊時繞錨點
            const f = d.hx && d.hy ? (Math.abs(fx-1)>=Math.abs(fy-1) ? fx : fy) : d.hx ? fx : fy;
            fx = fy = f;
            const w = w0*f, h = h0*f;
            if(d.hx<0) {x0 = x1-w;} else if(d.hx>0) {x1 = x0+w;} else {x0 = r.left + (w0-w)*ox; x1 = x0+w;}
            if(d.hy<0) {y0 = y1-h;} else if(d.hy>0) {y1 = y0+h;} else {y0 = r.top + (h0-h)*oy; y1 = y0+h;}
        }
        const rd = (v, n)=>Math.round(v*n)/n;
        const x = rd(x0 + ox*(x1-x0), 100), y = rd(y0 + oy*(y1-y0), 100);
        const {sx = 1, sy = 1, pct = 100} = o.data;
        d.patch = pctMode ? {x, y, pct:rd(pct*fx, 10000)} : {x, y, sx:rd(sx*fx, 10000), sy:rd(sy*fy, 10000)};
        const k = o.data.img.startsWith('file:') ? (d.patch.pct ?? pct)/100 : 1;
        o.sp.setScale(k*(d.patch.sx ?? sx), k*(d.patch.sy ?? sy));
        this._placeProp(o, x, y);
    }

    _send(msg) {window.parent.postMessage(msg, '*');}

    _recv(m)
    {
        switch(m.sb)
        {
            case 'load':
                if((m.scene.map ?? 'sandbox') !== this.mapName) {this._saveCam(); this.scene.restart({map:m.scene.map, scene:m.scene, grid:this._gridOn, sel:this._sel, hidden:[...this._hidden]});}
                else {this._apply(m.scene);}
                break;
            case 'grid': this._gridOn = !!m.on; this._drawGrid(); break;
            case 'anchor': this._anchorOn = !!m.on; break;
            case 'icons': this._icons = {light:!!m.light, particle:!!m.particle}; break;
            case 'home': this._home(); break;
            case 'select': this._sel = m.key ?? null; this._size = {lock:m.lock ?? 'pct', ratio:m.ratio ?? true}; break;
            case 'arm': this._arm = m.act ?? null; this._drawSel(); this._cursor(); break;
            case 'do': this._do(m.act); break;
            case 'replay': if(this._last) {this._do(this._last);} break;
            case 'reset': this._apply(this._scene, {force:true}); break;
            case 'hit': this._puppet(m.key)?.anim_hit?.(null); break;
            case 'fxTick': this._puppet(m.key)?.fxTick?.(m.id); break;
            case 'time': this._setTime(m.t); break;       // 拖滑桿預覽（還沒寫檔）
            case 'ambient': this._amb = m.color ?? null; this._ambient(); break;
            case 'play': this._play(m.speed); break;
            case 'die': this._puppet(m.key)?.die(); break;
            case 'revive': this._puppet(m.key)?.revive(); break;
            case 'hide':
                this._hidden = new Set(m.keys);
                this.roles.forEach(p=>p.setVisible(!this._hidden.has(p.key)));
                Object.entries(this._props).forEach(([k, o])=>o.sp.setVisible(!this._hidden.has(k)));
                Object.entries(this._emitters ?? {}).forEach(([k, o])=>o.fx?.emitter?.setVisible(!this._hidden.has(k)));
                Object.values(this._lights ?? {}).forEach(o=>this._lightI(o));
                break;
        }
    }

    _onResize(size)
    {
        GM.w = size.width;
        GM.h = size.height;
        this.cameras.main.setSize(size.width, size.height);
    }

    //------------------------------------------------------
    //  鏡頭：滾輪以游標為中心縮放、中鍵拖曳平移
    //------------------------------------------------------
    _initCam()
    {
        const c = cams[this.mapName];
        if(c) {this.cameras.main.setZoom(c.zoom).centerOn(c.x, c.y);}
        else {this._home();}
    }

    _saveCam()
    {
        const cam = this.cameras.main;
        cams[this.mapName] = {x:cam.midPoint.x, y:cam.midPoint.y, zoom:cam.zoom};
    }

    _home()
    {
        const cam = this.cameras.main;
        const {widthInPixels:w, heightInPixels:h} = this.map.map;
        cam.setZoom(Phaser.Math.Clamp(Math.min(cam.width/w, cam.height/h)*0.95, ...ZOOM));
        cam.centerOn(w/2, h/2);
        this._drawGrid();
    }

    _initInput()
    {
        const cam = this.cameras.main;
        this.input.on('wheel', (p, objs, dx, dy)=>{
            const before = cam.getWorldPoint(p.x, p.y);
            cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy>0 ? 1/1.15 : 1.15), ...ZOOM));
            cam.preRender();
            const after = cam.getWorldPoint(p.x, p.y);
            cam.scrollX += before.x - after.x;
            cam.scrollY += before.y - after.y;
            this._drawGrid();
        });
        this.input.on('pointerdown', (p)=>{
            if(p.middleButtonDown()) {this._pan = {x:p.x, y:p.y, sx:cam.scrollX, sy:cam.scrollY}; this._cursor(p); return;}
            const [tx, ty] = this.map.worldToTile(p.worldX, p.worldY);
            if(this._arm && p.leftButtonDown())
            {
                // 指定目標中：左鍵＝對那格／那個角色做動作（右鍵或 Esc 取消）
                this._do({...this._arm, tx, ty, tkey:this._roleAt(p.worldX, p.worldY)?.key ?? null});
                return;
            }
            if(p.rightButtonDown() && this._arm) {this._arm = null; this._send({sb:'disarm'}); this._cursor(p); return;}
            const hd = p.leftButtonDown() && this._handleAt(p.worldX, p.worldY);
            if(hd) {this._startResize(hd); return;}
            const rh = p.leftButtonDown() && this._radiusAt(p.worldX, p.worldY);
            if(rh) {this._drag = {radius:rh.o, key:this._sel}; return;}
            const hit = this._pickAt(p.worldX, p.worldY);
            if(p.rightButtonDown())
            {
                this._send({sb:'ctx', tx, ty, wx:Math.round(p.worldX), wy:Math.round(p.worldY), key:hit?.key ?? null, cx:p.event.clientX, cy:p.event.clientY});
                return;
            }
            this._sel = hit?.key ?? null;
            this._send({sb:'select', key:this._sel});
            if(hit?.role) {this._drag = {role:hit.role, from:this.map.worldToTile(hit.role.x, hit.role.y), to:null};}
            else if(hit?.prop) {this._drag = {prop:hit.prop, key:hit.key, dx:hit.prop.sp.x-p.worldX, dy:hit.prop.sp.y-p.worldY, moved:false};}
            else if(hit?.emitter)
            {
                const e = this._emitPos(hit.emitter);
                this._drag = {emitter:hit.emitter, key:hit.key, dx:e.x-p.worldX, dy:e.y-p.worldY, moved:false};
            }
            else if(hit?.light)
            {
                const e = this._lightPos(hit.light);
                this._drag = {light:hit.light, key:hit.key, dx:e.x-p.worldX, dy:e.y-p.worldY, moved:false};
            }
            this._cursor(p);
        });
        this.input.on('pointermove', (p)=>{
            if(this._pan)
            {
                if(!p.middleButtonDown()) {this._pan = null; return;}
                cam.scrollX = this._pan.sx - (p.x-this._pan.x)/cam.zoom;
                cam.scrollY = this._pan.sy - (p.y-this._pan.y)/cam.zoom;
            }
            else if(this._drag?.resize)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                this._resizeTo(this._drag, p.worldX, p.worldY, p.event.shiftKey);
            }
            else if(this._drag?.radius)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                this._radiusTo(this._drag, p.worldX, p.worldY, p.event.shiftKey);
            }
            else if(this._drag?.prop || this._drag?.emitter || this._drag?.light)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                // 自由拖；按住 Shift 錨點吸到 16px（格子交點＋格子中心）
                let x = p.worldX + this._drag.dx, y = p.worldY + this._drag.dy;
                if(p.event.shiftKey) {[x, y] = [x, y].map(v=>Math.round(v/16)*16);}
                else {[x, y] = [x, y].map(Math.round);}
                this._drag.moved = true;
                if(this._drag.prop) {this._placeProp(this._drag.prop, x, y);}
                else if(this._drag.light) {this._placeLight(this._drag.light, x, y);}
                else {this._placeEmitter(this._drag.emitter, x, y);}
            }
            else if(this._drag?.role?.active)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                const [tx, ty] = this.map.worldToTile(p.worldX, p.worldY);
                if(!this.map.isInside(tx, ty)) {return;}
                const pt = this.map.tileToWorld(tx, ty);
                this._drag.to = [tx, ty];
                this._drag.role.setPosition(pt.x, pt.y).updateDepth();
            }
            this._cursor(p);
        });
        this.input.on('pointerup', (p)=>{this._pan = null; this._endDrag(); this._cursor(p);});
        // iframe 有焦點時鍵盤在這裡：交給場景分頁（Del、Ctrl+Z…）
        const onKey = (e)=>this._send({sb:'key', key:e.key, ctrl:e.ctrlKey || e.metaKey, shift:e.shiftKey, alt:e.altKey});
        addEventListener('keydown', onKey);
        this.events.once('shutdown', ()=>removeEventListener('keydown', onKey));
    }

    // 指定中＝準星；拉大小／半徑中照把手；拖曳／平移中＝握拳；hover 把手＝雙箭頭、點得到的東西＝張開的手
    _cursor(p = this.input.activePointer)
    {
        const d = this._drag;
        if(d?.resize || d?.radius || !this._props) {return;}
        let c = '';
        if(this._arm) {c = 'crosshair';}
        else if(d || this._pan) {c = 'grabbing';}
        else
        {
            const hd = this._handleAt(p.worldX, p.worldY);
            c = hd ? (!hd.hy ? 'ew-resize' : !hd.hx ? 'ns-resize' : hd.hx*hd.hy>0 ? 'nwse-resize' : 'nesw-resize')
                : this._radiusAt(p.worldX, p.worldY) ? 'ew-resize' : this._pickAt(p.worldX, p.worldY) ? 'grab' : '';
        }
        this.game.canvas.style.cursor = c;
    }

    // 角色永遠站格子中心；放開才回報，場景分頁寫檔後送回來的資料一變就重建（重新登記路網權重）
    _endDrag()
    {
        const d = this._drag;
        this._drag = null;
        if(d?.resize)
        {
            if(d.patch) {this._send({sb:'resizeProp', key:d.key, patch:d.patch});}
            return;
        }
        if(d?.radius)
        {
            if(d.r!==undefined && d.r!==d.radius.data.r) {this._send({sb:'radiusLight', key:d.key, r:d.r});}
            return;
        }
        if(d?.light)
        {
            const {x, y} = d.light.data;
            if(d.moved) {this._send({sb:'moveLight', key:d.key, x, y});}
            return;
        }
        if(d?.emitter)
        {
            const {x, y} = d.emitter.data;
            if(d.moved) {this._send({sb:'moveEmitter', key:d.key, x, y});}
            return;
        }
        if(d?.prop)
        {
            const {x, y} = d.prop.sp;
            if(d.moved && (x!==d.prop.data.x || y!==d.prop.data.y)) {this._send({sb:'moveProp', key:d.key, x, y});}
            return;
        }
        if(!d?.to || (d.to[0]===d.from[0] && d.to[1]===d.from[1])) {return;}
        this._send({sb:'move', key:d.role.key, tx:d.to[0], ty:d.to[1]});
    }

    //------------------------------------------------------
    //  32×32 格線（地圖範圍內，線寬固定 1 螢幕 px）
    //------------------------------------------------------
    _drawGrid()
    {
        const g = this._grid;
        if(!g) {return;}
        g.clear();
        if(!this._gridOn) {return;}
        const {widthInPixels:w, heightInPixels:h} = this.map.map;
        g.lineStyle(1/this.cameras.main.zoom, 0xffffff, 0.22);
        for(let x=0; x<=w; x+=GM.TILE_W) {g.lineBetween(x, 0, x, h);}
        for(let y=0; y<=h; y+=GM.TILE_H) {g.lineBetween(0, y, w, y);}
    }
}
