import { GameScene } from './GameScene.js'
import { loadData } from './MainMenu.js'
import Map from '../manager/map.js'
import Record from '../infra/record.js'
import TimeSystem from '../systems/time.js'
import Utility from '../core/utility.js'
import {GameObject} from '../core/gameobject.js'
import {GM, GS} from '../core/setting.js'
import Puppet from '../roles/puppet.js'
import Item from '../items/item.js'
import DB from '../data/db.js'
import {playParticle} from '../core/particle.js'
import {setSpot} from '../core/spotlight.js'
import {queueTextures} from '../core/texlist.js'
import {shapeOf, zoneEditable, rectOf, handlesOf, hitZone, edgeZone, zoneArea, dragZone, ZONE_CURSOR} from '../core/pzone.js'

// 開發版的 gym 場景：工具殼「場景」分頁的 iframe 跑 /?sandbox，用 postMessage 操作（訊息帶 sb 欄位，見 docs/scene-tool.md）
// 繼承 GameScene 拿真的地圖／路網／Light2D，但沒有玩家、UI、回合、作息、劇情；地圖只建地形＋靜態物件，不寫存檔
const ZOOM = [0.25, 8];
const GRID_DEPTH = 1e7;
const HANDLE = 6;   // 擺設大小把手（螢幕 px）
const SEL_COLOR = 0xffffff;   // 選中的記號（不能跟占地方塊 grid/zone 撞色）
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
        this._frame = this._frameXY();
        this._camWH = [this.scale.width, this.scale.height];
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
        this._insts = {};
        this._drawGrid();
        this._initInput();
        this._initDrop();
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
        await this._loadPartFiles(scene.prefabs ?? []);
        if(this._scene!==scene) {return;}   // 載外部圖的期間又來了新的場景
        this._applyInsts(scene.prefabs ?? [], force);
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
        return await this._loadFile(img, img) ? [img] : null;
    }

    // file:<路徑> 載成 texture key（載過就跳過）
    async _loadFile(img, key)
    {
        if(!this.textures.exists(key))
        {
            await new Promise((res)=>{
                // vite：public/ 底下的檔在網址根目錄，其他照專案路徑；要完整網址，不然 loader 會接在 setPath('assets') 後面
                this.load.image(key, `${location.origin}/${img.slice(5).replace(/^public\//, '').split('/').map(encodeURIComponent).join('/')}`);
                this.load.once('complete', res);
                this.load.start();
            });
        }
        return this.textures.exists(key);
    }

    // 場景分頁的 prefab 草稿可能有還沒烤的 file: 零件：ItemView 用 : 切 frame，key 換成 file|<路徑>，pct 乘進 sx/sy
    static _pfFiles(pfs)
    {
        const conv = (p)=>{
            if(!p.img?.startsWith('file:')) {return p;}
            const {pct, ...q} = p, k = (pct ?? 100)/100;
            return {...q, img:`file|${p.img.slice(5)}`, sx:(p.sx ?? 1)*k, sy:(p.sy ?? 1)*k};
        };
        return Object.fromEntries(Object.entries(pfs).map(([id, pf])=>[id, pf.parts?.some(p=>p.img?.startsWith('file:')) ? {...pf, parts:pf.parts.map(conv)} : pf]));
    }

    async _loadPartFiles(insts)
    {
        const keys = new Set(insts.flatMap(i=>(DB.prefab(i.prefab)?.parts ?? []).map(p=>p.img).filter(k=>k?.startsWith('file|'))));
        for(const k of keys) {await this._loadFile(`file:${k.slice(5)}`, k);}
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

    //------------------------------------------------------
    //  prefab 實例：{key, prefab, x, y（錨點的世界座標）, look?}，建成真的遊戲物件（Item＋ItemView，同遊戲）
    //  prefab.json 跟著 load 訊息送來（m.prefabs，蓋掉 DB），資料或那筆 prefab 變了就重建；👁 藏＝不建
    //------------------------------------------------------
    _applyInsts(list, force)
    {
        const pdefs = (pf)=>(pf?.parts ?? []).map(p=>(p.particle ? DB._particleDB?.[p.particle] ?? null : null));
        const sig = (i)=>{const pf = DB.prefab(i.prefab); return JSON.stringify([i, pf ?? null, pdefs(pf), this._hidden.has(i.key)]);};
        const want = Object.fromEntries(list.map(i=>[i.key, i]));
        for(const [k, o] of Object.entries(this._insts))
        {
            if(force || !want[k] || sig(want[k])!==o.sig || !o.go.active) {this._dropInst(k);}
        }
        const bad = [];
        for(const i of list)
        {
            if(this._insts[i.key]) {continue;}
            const pf = DB.prefab(i.prefab);
            if(!pf) {bad.push(i.prefab); continue;}
            if(this._hidden.has(i.key)) {continue;}
            const go = new Item(this, i.x, i.y);   // uid -1（runtime）：位置就是錨點
            go.bb.prefab = i.prefab;
            if(i.look) {go.bb.look = i.look;}
            go.init_prefab();
            this._insts[i.key] = {go, data:i, sig:sig(i)};
        }
        if(bad.length) {this._send({sb:'error', msg:`prefab.json 沒有：${[...new Set(bad)].join('、')}`});}
    }

    //------------------------------------------------------
    //  選中的 prefab 實例（場景分頁送 inspect {key, boxes:{grid,zone}, boxSel:[k…], partSel:[i…], part}）：
    //  只畫選取的（右欄右鍵選，可多選）：方塊（grid 藍、zone 綠）＋4 邊中點把手（照 grid→zone 搶，放開回報 box {key, k, box}）、
    //  零件外框，選取的零件按住拖＝所有選取的一起動（放開回報 moveParts {key, moves:[{i, x, y}]}，相對錨點；
    //  png、光源跟著動，粒子只動外框）；沒拖動＝回報 part {key, i}（分頁展開它）
    //------------------------------------------------------
    static BOX_COLOR = {grid:0x55aaff, zone:0x66dd66};
    static BOX_ORDER = ['grid', 'zone'];

    _inspected()
    {
        const k = this._inspect?.key;
        return k && k===this._sel && this._insts[k]?.go.active ? this._insts[k] : null;
    }

    // 零件 i 的位置（世界座標）；png 多一個外框 rect（不算角度）、光源多半徑 r
    _partGeom(o, i)
    {
        const p = DB.prefab(o.data.prefab)?.parts?.[i];
        if(!p) {return null;}
        // 拖選取的零件中：所有選取的照被拖那個的位移一起挪
        const d = this._drag?.p && this._drag.sel.includes(i) ? this._drag : null;
        const x = o.go.x + (p.x ?? 0) + (d ? d.x - (d.p.x ?? 0) : 0), y = o.go.y + (p.y ?? 0) + (d ? d.y - (d.p.y ?? 0) : 0);
        if(!p.img) {return {x, y, r:p.light ? p.light.r ?? 120 : null};}
        const [key, frame] = p.img.split(':');
        const f = this.textures.exists(key) && this.textures.getFrame(key, frame);
        if(!f) {return {x, y};}
        const w = f.width*Math.abs(p.sx ?? 1), h = f.height*Math.abs(p.sy ?? 1);
        return {x, y, rect:new Phaser.Geom.Rectangle(x - (p.ox ?? 0.5)*w, y - (p.oy ?? 1)*h, w, h)};
    }

    // 零件 i 選取了（停用的不算）
    _partSel(i)
    {
        const o = this._insts?.[this._inspect?.key];
        return !!this._inspect?.partSel?.includes(i) && !!o && !DB.prefab(o.data.prefab)?.parts?.[i]?.off;
    }
    _boxSel(k) {return !!this._inspect?.boxSel?.includes(k);}

    // 點到選中實例的哪個選取的零件（目前狀態看得到的；粒子／光源的點優先，png 照前後取最上面）；沒有＝null
    _partAt(o, wx, wy)
    {
        const parts = DB.prefab(o.data.prefab)?.parts ?? [], look = o.go.getLook?.() ?? null, tol = 8/this.cameras.main.zoom;
        let best = null;
        parts.forEach((p, i)=>{
            const g = this._partSel(i) && (!p.look || p.look===look) && this._partGeom(o, i);
            if(!g) {return;}
            if(!p.img) {if(Math.hypot(g.x - wx, g.y - wy)<=tol) {best = {i, z:Infinity};} return;}
            const z = p.depth ?? 0;
            if(g.rect?.contains(wx, wy) && (!best || z>=best.z)) {best = {i, z};}
        });
        return best ? best.i : null;
    }

    // 方塊 k 目前的樣子（拖把手中＝拖曳中的值）
    _box(k)
    {
        const d = this._drag;
        return d?.box===k ? d.cur : this._inspect?.boxes?.[k] ?? null;
    }

    // 選取的方塊的 4 邊中點把手（世界座標），照 grid→zone
    _boxHandles()
    {
        const o = this._inspected();
        if(!o) {return [];}
        const ax = o.go.x, ay = o.go.y, out = [];
        for(const k of Sandbox.BOX_ORDER)
        {
            const b = this._box(k);
            if(!b || !this._boxSel(k)) {continue;}
            const l = ax + b.x, t = ay + b.y, cx = l + b.w/2, cy = t + b.h/2;
            out.push({k, side:'l', x:l, y:cy}, {k, side:'r', x:l + b.w, y:cy}, {k, side:'t', x:cx, y:t}, {k, side:'b', x:cx, y:t + b.h});
        }
        return out;
    }

    _boxHandleAt(wx, wy)
    {
        const r = (HANDLE/2 + 2)/this.cameras.main.zoom;
        return this._boxHandles().find(hd=>Math.abs(hd.x - wx)<=r && Math.abs(hd.y - wy)<=r) ?? null;
    }

    // 拖方塊的邊：對邊固定、不能拉過對邊（最少 1px），Shift 吸 16px（世界座標）
    _boxTo(d, wx, wy, shift)
    {
        const go = d.inst.go, b0 = d.b0, snap = (v)=>(shift ? Math.round(v/16)*16 : Math.round(v));
        const rx = snap(wx) - go.x, ry = snap(wy) - go.y, b = {...b0};
        if(d.side==='l') {const r = b0.x + b0.w; b.x = Math.min(rx, r - 1); b.w = r - b.x;}
        else if(d.side==='r') {b.w = Math.max(1, rx - b0.x);}
        else if(d.side==='t') {const bt = b0.y + b0.h; b.y = Math.min(ry, bt - 1); b.h = bt - b.y;}
        else {b.h = Math.max(1, ry - b0.y);}
        d.cur = b;
    }

    // 選中實例裡選取的光源零件（目前狀態看得到＝有建燈）：[{i, light}]
    _partLights()
    {
        const o = this._inspected();
        return o ? (o.go.view?._parts ?? []).filter(e=>e.light && this._partSel(e.i)).map(e=>({i:e.i, light:e.light})) : [];
    }

    // 選取的光源零件的把手（半徑＋聚光燈弧兩端）
    _partLightHandles()
    {
        return this._partLights().flatMap(({i, light})=>Sandbox._lightHandles({x:light.x, y:light.y}, light).map(h=>({i, light, ...h})));
    }
    _partLightHandleAt(wx, wy) {return this._partLightHandles().find(h=>this._near(h, wx, wy)) ?? null;}

    // 拖光源零件的把手：直接改燈（放開送 partLight {key, i, patch}，分頁寫進草稿）
    _partLightTo(d, wx, wy, snap)
    {
        const L = d.plight, c = {x:L.x, y:L.y}, s = L.spot;
        if(d.kind==='radius')
        {
            const {r, dir} = Sandbox._radiusFrom(c, wx, wy, snap, s);
            d.r = r;
            L.setRadius(r);
            if(dir!==undefined) {d.dir = (dir % 360 + 360) % 360; setSpot(L, {...s, dir:d.dir});}
        }
        else
        {
            d.arc = Sandbox._arcFrom(c, s.dir, wx, wy, snap);
            setSpot(L, {...s, arc:d.arc});
        }
    }

    // 拖曳中改了哪些欄位（半徑把手＝r，聚光燈加 dir；弧＝arc）
    static _partLightVals(d)
    {
        return d.kind==='arc' ? {arc:d.arc} : {r:d.r, ...(d.dir!==undefined && {dir:d.dir})};
    }

    _drawInspect(g, z)
    {
        const o = this._inspected();
        if(!o) {return;}
        const ax = o.go.x, ay = o.go.y, look = o.go.getLook?.() ?? null;
        const lights = Object.fromEntries(this._partLights().map(e=>[e.i, e.light]));
        for(const k of [...Sandbox.BOX_ORDER].reverse())
        {
            const b = this._box(k);
            if(b && this._boxSel(k)) {g.lineStyle(2/z, Sandbox.BOX_COLOR[k], 1).strokeRect(ax + b.x, ay + b.y, b.w, b.h);}
        }
        (DB.prefab(o.data.prefab)?.parts ?? []).forEach((p, i)=>{
            const pg = this._partSel(i) && (!p.look || p.look===look) && this._partGeom(o, i);
            if(!pg) {return;}
            const a = 1;
            g.lineStyle(2/z, 0x33ccff, a);
            if(pg.rect) {g.strokeRectShape(pg.rect);}
            else
            {
                if(pg.r) {Sandbox._drawSun(g, z, pg.x, pg.y, null, 0x33ccff, 2/z);}   // 光源＝太陽記號
                else {g.strokeCircle(pg.x, pg.y, 6/z);}
                const L = lights[i];
                if(L) {Sandbox._drawLightRange(g, z, pg.x, pg.y, L.radius, L.spot, 0x33ccff);}
            }
        });
        const zs = this._pzSel();
        for(const w of this._partZoneOwners()) {this._drawZoneList(g, z, w.c, w.zones, zs?.i===w.i ? zs.k : null);}
        const s = HANDLE/z;
        for(const hd of this._partLightHandles())
        {
            g.fillStyle(0x33ccff, 1).fillRect(hd.x-s/2, hd.y-s/2, s, s).lineStyle(1/z, 0x000000, 1).strokeRect(hd.x-s/2, hd.y-s/2, s, s);
        }
        for(const hd of this._boxHandles().reverse())
        {
            g.fillStyle(Sandbox.BOX_COLOR[hd.k], 1).fillRect(hd.x-s/2, hd.y-s/2, s, s).lineStyle(1/z, 0x000000, 1).strokeRect(hd.x-s/2, hd.y-s/2, s, s);
        }
    }

    // 光源記號＝太陽：圓（半徑 6 螢幕 px，fill＝光色、null＝空心）＋圈外 8 條光線（8～12 px）；
    //  光線先描一層 line 色的粗線、再疊光色細線（空心的就只有 line 色）
    static _drawSun(g, z, x, y, fill, line, lw)
    {
        const r = 6/z, r0 = 8/z, r1 = 12/z;
        const rays = (w, c)=>{
            g.lineStyle(w, c, 1);
            for(let i=0; i<8; i++) {const a = i*Math.PI/4, cs = Math.cos(a), sn = Math.sin(a); g.lineBetween(x + r0*cs, y + r0*sn, x + r1*cs, y + r1*sn);}
        };
        if(fill===null) {rays(lw, line); g.lineStyle(lw, line, 1).strokeCircle(x, y, r); return;}
        rays(lw + 1.5/z, line);
        rays(1.5/z, fill);
        g.fillStyle(fill, 1).fillCircle(x, y, r).lineStyle(lw, line, 1).strokeCircle(x, y, r);
    }

    // 拖選取的零件（d.p＝被拖的那個，d.sel＝所有選取的 index）：png 的 holder、光源照同一個位移跟著動
    //  （放開等分頁寫進草稿、送回來重建）
    _placePart(d, x, y)
    {
        d.x = x;
        d.y = y;
        d.moved = true;
        const parts = DB.prefab(d.inst.data.prefab)?.parts ?? [], dx = x - (d.p.x ?? 0), dy = y - (d.p.y ?? 0);
        for(const e of d.inst.go.view?._parts ?? [])
        {
            if(!d.sel.includes(e.i)) {continue;}
            const q = parts[e.i], px = (q.x ?? 0) + dx, py = (q.y ?? 0) + dy;
            if(e.holder) {e.holder.setPosition(px, py);}
            if(e.light) {e.light.x = d.inst.go.x + px; e.light.y = d.inst.go.y + py;}
        }
    }

    _dropInst(k)
    {
        const o = this._insts[k];
        if(o.go.active) {o.go._remove();}
        delete this._insts[k];
    }

    _placeInst(o, x, y)
    {
        o.go.setPosition(x, y);
        o.go.updateDepth();
        o.go.view?._syncLights?.();
    }

    // 從場景分頁左欄的 prefab 庫拖進來（HTML5 拖放，同源 iframe 讀得到 dataTransfer）
    _initDrop()
    {
        const cv = this.game.canvas, cam = this.cameras.main;
        const over = (e)=>{if(e.dataTransfer?.types.includes('application/x-prefab')) {e.preventDefault(); e.dataTransfer.dropEffect = 'copy';}};
        const drop = (e)=>{
            const id = e.dataTransfer?.getData('application/x-prefab');
            if(!id) {return;}
            e.preventDefault();
            const r = cv.getBoundingClientRect();
            const p = cam.getWorldPoint((e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height);
            this._send({sb:'dropPrefab', id, wx:Math.round(p.x), wy:Math.round(p.y)});
        };
        cv.addEventListener('dragover', over);
        cv.addEventListener('drop', drop);
        this.events.once('shutdown', ()=>{cv.removeEventListener('dragover', over); cv.removeEventListener('drop', drop);});
    }

    // 拖曳中：深度照新的 y（跟著它的光源每幀在 update 跟上、粒子跟著 sprite）
    // 切了前後片的擺設：後片（of＝前片 key）跟著前片的位置、大小，深度用自己的 depth
    _placeProp(o, x, y)
    {
        o.sp.setPosition(x, y).setDepth(y + (o.data.depth ?? 0));
        for(const b of Object.values(this._props))
        {
            if(b!==o && b.data.of===o.data.key) {b.sp.setPosition(x, y).setScale(o.sp.scaleX, o.sp.scaleY).setDepth(y + (b.data.depth ?? 0));}
        }
    }

    // 點到後片＝選前片（一組當一個東西）
    _frontOf(key)
    {
        const of = this._props[key]?.data.of;
        return of && this._props[of] ? of : key;
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
    //  粒子發射點：{key, id（particle.json）, x, y, follow?（角色／擺設 key：x/y 變成相對它）, every?（burst 幾 ms 噴一次）, def?（發射點自己那份，有就不查 particle.json）}
    //  畫面上畫一個橘色菱形讓它點得到、拖得動（只在 sandbox 裡，不是遊戲的東西）
    //------------------------------------------------------
    _applyEmitters(list, force)
    {
        this._emitters ??= {};
        const want = Object.fromEntries(list.map(e=>[e.key, e]));
        // 簽名含 particle.json 那筆（沒有自己那份時）：分頁改了 particle.json 不重開，靠這個重建
        const sig = (e)=>JSON.stringify([e, e.def ? null : DB._particleDB?.[e.id] ?? null]);
        for(const [k, o] of Object.entries(this._emitters))
        {
            const e = want[k];
            if(force || !e || sig(e)!==o.sig || (e.follow && this._target(e.follow)!==o.target)) {this._dropEmitter(k);}
        }
        const bad = [];
        for(const e of list)
        {
            if(this._emitters[e.key]) {continue;}
            const def = e.def ?? DB.particle(e.id);
            if(!def) {bad.push(e.id);}
            this._emitters[e.key] = {data:e, sig:sig(e), def, target:this._target(e.follow)};
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
    //  光源：{key, x, y, r, color（'#rrggbb'）, i?（沒寫＝GM.LIGHT，同 com_lamp）, follow?（角色／擺設 key：x/y 變成相對它）,
    //        dir?/arc?/soft?（聚光燈，core/spotlight.js；跟著角色時資料＝朝右的樣子，朝左鏡像）}
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
            this._lightSpot(o);
        }
    }

    _lightPos(o)
    {
        const t = o.target?.active ? o.target : null;
        return {x:(t?.x ?? 0) + (this._mirror(o) ? -o.data.x : o.data.x), y:(t?.y ?? 0) + o.data.y};
    }

    // 跟著角色、角色朝左：x 偏移跟方向都鏡像（資料是朝右時的樣子）；擺設不轉身
    _mirror(o) {return o.target?.active && o.target.faceDir?.() === -1;}

    _lightSpot(o)
    {
        const {dir = 0, arc, soft} = o.data;
        setSpot(o.light, {dir:this._mirror(o) ? 180 - dir : dir, arc, soft});
    }

    // 亮度：藏著＝0、有寫 i 用它、沒寫＝GM.LIGHT（日夜交給 shader：起壓點至少是環境光，白天燈自然加不上去）
    _lightI(o)
    {
        o.light.intensity = this._hidden.has(o.data.key) ? 0 : o.data.i ?? GM.LIGHT;
    }

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
        const t = o.target?.active ? o.target : null, dx = x-(t?.x ?? 0);
        o.data = {...o.data, x:this._mirror(o) ? -dx : dx, y:y-(t?.y ?? 0)};
        o.light.setPosition(x, y);
    }

    //------------------------------------------------------
    //  選中發射點的 emitZone（綠）／deathZone（紅虛線）：點選、拖本體／把手改，放開送 zone {key, k, z}（場景分頁寫進發射點自己那份 def）
    //  座標相對發射位置＝發射點＋粒子自己的 x/y（同 playParticle）
    //------------------------------------------------------
    _zoneEm()
    {
        const o = this._emitters?.[this._sel];
        return o?.def && !this._hidden.has(this._sel) ? o : null;
    }

    _zoneOrigin(o)
    {
        const p = this._emitPos(o);
        return {x:p.x + (o.def.x ?? 0), y:p.y + (o.def.y ?? 0)};
    }

    // [{k, z, edit}]：拖曳中用草稿
    _zones(o)
    {
        return ['emitZone', 'deathZone'].filter(k=>o.def[k]!==undefined).map(k=>{
            const z = this._drag?.zone===k && this._drag.cur ? this._drag.cur : o.def[k];
            return {k, z, edit:zoneEditable(k, z)};
        });
    }

    // 游標底下的 zone 把手（只有選中的那個 zone）
    _zoneHandleAt(wx, wy)
    {
        const o = this._zoneEm();
        const sel = o && this._zsel?.key===this._sel && this._zones(o).find(z=>z.k===this._zsel.k && z.edit);
        if(!sel) {return null;}
        const c = this._zoneOrigin(o), tol = (HANDLE/2 + 2)/this.cameras.main.zoom;
        const d = (q)=>Math.max(Math.abs(c.x + q.x - wx), Math.abs(c.y + q.y - wy));
        const hd = handlesOf(shapeOf(sel.z.source), sel.z.source).filter(q=>d(q)<=tol).sort((a, b)=>d(a) - d(b))[0];
        return hd ? {o, k:sel.k, z:sel.z, part:hd.id} : null;
    }

    // 游標底下的 zone 本體（疊在一起挑面積小的）；edge＝只算框線內外 6px（蓋過角色／擺設）
    _zoneBodyAt(wx, wy, edge = false)
    {
        const o = this._zoneEm();
        if(!o) {return null;}
        const c = this._zoneOrigin(o), tol = (edge ? 6 : 4)/this.cameras.main.zoom, f = edge ? edgeZone : hitZone;
        const hits = this._zones(o).filter(z=>z.edit && f(shapeOf(z.z.source), z.z.source, wx - c.x, wy - c.y, tol))
            .sort((a, b)=>zoneArea(shapeOf(a.z.source), a.z.source) - zoneArea(shapeOf(b.z.source), b.z.source));
        return hits[0] ? {o, k:hits[0].k, z:hits[0].z, part:'move'} : null;
    }

    _startZone(hit, p)
    {
        const c = this._zoneOrigin(hit.o);
        this._zsel = {key:this._sel, k:hit.k};
        this._drag = {zone:hit.k, key:this._sel, o:hit.o, z0:structuredClone(hit.z), shape:shapeOf(hit.z.source), part:hit.part,
            p0:{x:p.worldX - c.x, y:p.worldY - c.y}, cur:null};
    }

    _zoneTo(d, p)
    {
        const c = this._zoneOrigin(d.o);
        d.cur = {...d.z0, source:dragZone(d.shape, d.z0.source, d.part, d.p0, {x:p.worldX - c.x, y:p.worldY - c.y}, p.event.shiftKey ? 4 : 1)};
    }

    _drawZones(g, z)
    {
        const o = this._zoneEm();
        if(!o) {return;}
        this._drawZoneList(g, z, this._zoneOrigin(o), this._zones(o), this._zsel?.key===this._sel ? this._zsel.k : null);
    }

    // zones＝[{k, z, edit}]，c＝zone 座標的原點（世界），selK＝選中的那個 zone（畫把手）
    _drawZoneList(g, z, c, zones, selK)
    {
        const dash = (x1, y1, x2, y2, d)=>{
            const n = Math.max(1, Math.floor(Math.hypot(x2-x1, y2-y1)/d));
            for(let i=0; i<n; i+=2) {g.lineBetween(x1+(x2-x1)*i/n, y1+(y2-y1)*i/n, x1+(x2-x1)*Math.min(n, i+1)/n, y1+(y2-y1)*Math.min(n, i+1)/n);}
        };
        for(const {k, z:zz, edit} of zones)
        {
            const death = k==='deathZone', sel = selK===k, d = death ? 4/z : 0;
            g.lineStyle(1.5/z, death ? 0xff5555 : 0x44dd66, sel ? 1 : 0.75);
            for(const one of [zz].flat())
            {
                const s = one?.source, shape = shapeOf(s);
                if(shape==='circle')
                {
                    const cx = c.x + (s.x ?? 0), cy = c.y + (s.y ?? 0);
                    if(!d) {g.strokeCircle(cx, cy, s.r); continue;}
                    const n = Math.max(12, Math.round(s.r*2*Math.PI/d) & ~1);
                    for(let i=0; i<n; i+=2) {g.beginPath().arc(cx, cy, s.r, i/n*Math.PI*2, (i+1)/n*Math.PI*2).strokePath();}
                }
                else if(shape==='line') {d ? dash(c.x+s.x1, c.y+s.y1, c.x+s.x2, c.y+s.y2, d) : g.lineBetween(c.x+s.x1, c.y+s.y1, c.x+s.x2, c.y+s.y2);}
                else if(shape==='rect')
                {
                    const r = rectOf(s), l = c.x + r.x, t = c.y + r.y;
                    if(!d) {g.strokeRect(l, t, r.w, r.h); continue;}
                    dash(l, t, l+r.w, t, d); dash(l+r.w, t, l+r.w, t+r.h, d); dash(l+r.w, t+r.h, l, t+r.h, d); dash(l, t+r.h, l, t, d);
                }
            }
            if(!sel || !edit) {continue;}
            const hs = HANDLE/z;
            for(const q of handlesOf(shapeOf(zz.source), zz.source))
            {
                g.fillStyle(0xffffff, 1).fillRect(c.x+q.x-hs/2, c.y+q.y-hs/2, hs, hs)
                    .lineStyle(1/z, death ? 0xff5555 : 0x44dd66, 1).strokeRect(c.x+q.x-hs/2, c.y+q.y-hs/2, hs, hs);
            }
        }
    }

    //------------------------------------------------------
    //  選中 prefab 實例的 edit 粒子零件的 zone：畫法／拖法同發射點，放開送 partZone {key, i, k, z}（分頁寫草稿，共用的先複製成 def）
    //  原點＝錨點＋零件 x/y＋粒子自己的 x/y；選中的 zone＝_pzsel {key, i, k}
    //------------------------------------------------------
    _partZoneOwners()
    {
        const o = this._inspected();
        if(!o) {return [];}
        const look = o.go.getLook?.() ?? null, d = this._drag;
        return (DB.prefab(o.data.prefab)?.parts ?? []).flatMap((p, i)=>{
            if(!p.particle || !this._partSel(i) || (p.look && p.look!==look)) {return [];}
            const def = DB.particle(p.particle), pg = def && this._partGeom(o, i);
            if(!pg) {return [];}
            const zones = ['emitZone', 'deathZone'].filter(k=>def[k]!==undefined).map(k=>{
                const z = d?.pzone===k && d.i===i && d.cur ? d.cur : def[k];
                return {k, z, edit:zoneEditable(k, z)};
            });
            return [{i, c:{x:pg.x + (def.x ?? 0), y:pg.y + (def.y ?? 0)}, zones}];
        });
    }

    _pzSel() {return this._pzsel?.key===this._sel ? this._pzsel : null;}

    _pzHandleAt(wx, wy)
    {
        const s = this._pzSel(), w = s && this._partZoneOwners().find(w=>w.i===s.i), sel = w?.zones.find(z=>z.k===s.k && z.edit);
        if(!sel) {return null;}
        const tol = (HANDLE/2 + 2)/this.cameras.main.zoom;
        const d = (q)=>Math.max(Math.abs(w.c.x + q.x - wx), Math.abs(w.c.y + q.y - wy));
        const hd = handlesOf(shapeOf(sel.z.source), sel.z.source).filter(q=>d(q)<=tol).sort((a, b)=>d(a) - d(b))[0];
        return hd ? {w, k:sel.k, z:sel.z, part:hd.id} : null;
    }

    // edge＝所有 edit 粒子零件 zone 的框線內外 6px；不是 edge＝只算選中那個 zone 的框內（疊在一起挑面積小的）
    _pzBodyAt(wx, wy, edge = false)
    {
        const s = this._pzSel(), tol = (edge ? 6 : 4)/this.cameras.main.zoom, f = edge ? edgeZone : hitZone;
        const area = (h)=>zoneArea(shapeOf(h.z.source), h.z.source);
        const hits = this._partZoneOwners().flatMap(w=>w.zones
            .filter(z=>z.edit && (edge || (s?.i===w.i && s.k===z.k)) && f(shapeOf(z.z.source), z.z.source, wx - w.c.x, wy - w.c.y, tol))
            .map(z=>({w, k:z.k, z:z.z, part:'move'}))).sort((a, b)=>area(a) - area(b));
        return hits[0] ?? null;
    }

    _startPartZone(hit, p)
    {
        const c = hit.w.c;
        this._pzsel = {key:this._sel, i:hit.w.i, k:hit.k};
        this._drag = {pzone:hit.k, i:hit.w.i, key:this._sel, z0:structuredClone(hit.z), shape:shapeOf(hit.z.source), part:hit.part,
            p0:{x:p.worldX - c.x, y:p.worldY - c.y}, cur:null};
        if(this._inspect?.part!==hit.w.i) {this._send({sb:'part', key:this._sel, i:hit.w.i});}
    }

    _partZoneTo(d, p)
    {
        const w = this._partZoneOwners().find(w=>w.i===d.i);
        if(!w) {return;}
        d.cur = {...d.z0, source:dragZone(d.shape, d.z0.source, d.part, d.p0, {x:p.worldX - w.c.x, y:p.worldY - w.c.y}, p.event.shiftKey ? 4 : 1)};
    }

    // 記號畫不畫、點不點得到：👁 藏著＝不；工具列「光源記號／粒子記號」沒勾＝只有選中的那個
    _markOn(kind, k)
    {
        return !this._hidden.has(k) && (this._icons?.[kind] !== false || k===this._sel);
    }

    // 燈 light（圓心 c）的把手：半徑（點光源在圈的右邊、聚光燈在中線末端）＋聚光燈弧兩端；方向＝畫面上的（鏡像後的）
    static _lightHandles(c, light)
    {
        const R = light.radius, s = light.spot;
        const at = (deg)=>({x:c.x + R*Math.cos(deg*Math.PI/180), y:c.y + R*Math.sin(deg*Math.PI/180)});
        return [{kind:'radius', ...at(s?.dir ?? 0)}, ...(s ? [-1, 1].map(k=>({kind:'arc', ...at(s.dir + k*s.arc/2)})) : [])];
    }

    // 拖半徑把手：r＝游標到圓心的距離（整數、最少 1；Shift 吸 16 的倍數）；聚光燈連畫面上的方向一起給（Shift 吸 15°）
    static _radiusFrom(c, wx, wy, snap, spot)
    {
        const dist = Math.hypot(wx-c.x, wy-c.y), r = Math.max(1, snap ? Math.round(dist/16)*16 : Math.round(dist));
        if(!spot) {return {r};}
        const a = Math.atan2(wy-c.y, wx-c.x)*180/Math.PI;
        return {r, dir:snap ? Math.round(a/15)*15 : Math.round(a)};
    }

    // 拖弧端：光錐＝兩倍的「游標跟中線夾角」（1～359；Shift 吸 15°）
    static _arcFrom(c, dir, wx, wy, snap)
    {
        const diff = Math.abs(((Math.atan2(wy-c.y, wx-c.x)*180/Math.PI - dir) % 360 + 540) % 360 - 180);
        const arc = snap ? Math.round(diff*2/15)*15 : Math.round(diff*2);
        return Math.min(359, Math.max(1, arc));
    }

    // 範圍：點光源＝虛線圈；聚光燈＝扇形（兩條虛線邊＋虛線弧，中線淡淡的）
    static _drawLightRange(g, z, x, y, R, sp, color)
    {
        g.lineStyle(1.5/z, color, 0.9);
        if(!sp)
        {
            const n = 64;
            for(let i=0; i<n; i+=2) {g.beginPath().arc(x, y, R, i/n*Math.PI*2, (i+1)/n*Math.PI*2).strokePath();}
            return;
        }
        const rad = Math.PI/180, a0 = (sp.dir - sp.arc/2)*rad, a1 = (sp.dir + sp.arc/2)*rad;
        const n = Math.max(2, Math.round(sp.arc/360*64) & ~1);
        for(let i=0; i<n; i+=2) {g.beginPath().arc(x, y, R, a0 + (a1-a0)*i/n, a0 + (a1-a0)*(i+1)/n).strokePath();}
        const dash = (a)=>{const m = Math.max(2, Math.round(R*z/8)); for(let i=0; i<m; i+=2) {g.lineBetween(x + R*i/m*Math.cos(a), y + R*i/m*Math.sin(a), x + R*(i+1)/m*Math.cos(a), y + R*(i+1)/m*Math.sin(a));}};
        dash(a0); dash(a1);
        g.lineStyle(1/z, color, 0.4).lineBetween(x, y, x + R*Math.cos(sp.dir*rad), y + R*Math.sin(sp.dir*rad));
    }

    // 選中光源的把手
    _sceneLightHandles()
    {
        const o = this._lights?.[this._sel];
        if(!o || this._hidden.has(this._sel)) {return [];}
        return Sandbox._lightHandles(this._lightPos(o), o.light).map(h=>({o, ...h}));
    }
    _radiusHandle() {return this._sceneLightHandles().find(h=>h.kind==='radius') ?? null;}
    _arcHandles() {return this._sceneLightHandles().filter(h=>h.kind==='arc');}

    _near(h, wx, wy)
    {
        const s = (HANDLE/2 + 2)/this.cameras.main.zoom;
        return h && Math.abs(h.x-wx)<=s && Math.abs(h.y-wy)<=s ? h : null;
    }

    _radiusAt(wx, wy) {return this._near(this._radiusHandle(), wx, wy);}
    _arcAt(wx, wy) {return this._arcHandles().find(h=>this._near(h, wx, wy)) ?? null;}

    // 拖選中光源的半徑把手（聚光燈連方向，存的是鏡像前的）
    _radiusTo(d, wx, wy, snap)
    {
        const o = d.radius, {r, dir} = Sandbox._radiusFrom(this._lightPos(o), wx, wy, snap, o.light.spot);
        d.r = r;
        o.light.setRadius(r);
        if(dir===undefined) {return;}
        d.dir = ((this._mirror(o) ? 180 - dir : dir) % 360 + 360) % 360;
        o.data = {...o.data, dir:d.dir};
        this._lightSpot(o);
    }

    _arcTo(d, wx, wy, snap)
    {
        const o = d.arc;
        d.v = Sandbox._arcFrom(this._lightPos(o), o.light.spot.dir, wx, wy, snap);
        o.data = {...o.data, arc:d.v};
        this._lightSpot(o);
    }

    // 跟著東西的光每幀跟上
    _syncLights()
    {
        for(const o of Object.values(this._lights ?? {}))
        {
            if(o.target) {const p = this._lightPos(o); o.light.setPosition(p.x, p.y); this._lightSpot(o);}
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
        const roles = this.roles.filter(p=>p.visible);
        const hits = roles.filter(p=>p.getShapeRect?.().contains(wx, wy));
        if(hits.length) {return hits.reduce((a, b)=>(b.depth>a.depth ? b : a));}
        const [tx, ty] = this.map.worldToTile(wx, wy);
        return roles.find(p=>this.map.worldToTile(p.x, p.y).every((v, i)=>v===[tx, ty][i]));
    }

    // 點到的東西（角色或擺設，最上面那個）：{key, role?, prop?}
    _pickAt(wx, wy)
    {
        const em = this._emitterAt(wx, wy);   // 發射點、光源的記號畫在最上面
        if(em) {return {key:em[0], emitter:em[1]};}
        const li = this._lightAt(wx, wy);
        if(li) {return {key:li[0], light:li[1]};}
        const fa = this._instAt(wx, wy);
        if(fa) {return {key:fa[0], inst:fa[1]};}
        const hits = [
            ...this.roles.filter(p=>p.visible && p.getShapeRect?.().contains(wx, wy)).map(role=>({key:role.key, role, depth:role.depth})),
            ...Object.entries(this._props).filter(([, o])=>o.sp.visible && o.sp.getBounds().contains(wx, wy))
                .map(([key, prop])=>({key:this._frontOf(key), prop:this._props[this._frontOf(key)], depth:prop.sp.depth})),
        ];
        if(hits.length) {return hits.reduce((a, b)=>(b.depth>a.depth ? b : a));}
        const fb = this._instBoxAt(wx, wy);
        if(fb) {return {key:fb[0], inst:fb[1]};}
        const role = this._roleAt(wx, wy);
        return role ? {key:role.key, role} : null;
    }

    // prefab 實例的點選框（世界座標，只給場景分頁點選／拖曳，不是 zone）：目前看得見的 png 外接框（含角度）；
    // 沒有＝看得見的粒子／光源點外擴 16、最少 32×32；連點都沒有＝錨點正中 32×32
    _instBox(o)
    {
        const parts = DB.prefab(o.data.prefab)?.parts ?? [], look = o.go.getLook?.() ?? null;
        const img = [], pts = [];
        parts.forEach((p, i)=>{
            if(p.off || (p.look && p.look!==look)) {return;}
            const g = this._partGeom(o, i);
            if(!g) {return;}
            if(g.rect)
            {
                const a = (p.angle ?? 0)*Math.PI/180, c = Math.cos(a), s = Math.sin(a), r = g.rect;
                for(const [px, py] of [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]])
                {
                    img.push({x:g.x + (px-g.x)*c - (py-g.y)*s, y:g.y + (px-g.x)*s + (py-g.y)*c});
                }
            }
            else if(!p.img) {pts.push(g);}
        });
        const bound = (ps, pad)=>{
            const xs = ps.map(q=>q.x), ys = ps.map(q=>q.y);
            return {l:Math.min(...xs)-pad, t:Math.min(...ys)-pad, r:Math.max(...xs)+pad, b:Math.max(...ys)+pad};
        };
        if(img.length) {const b = bound(img, 0); return new Phaser.Geom.Rectangle(b.l, b.t, b.r-b.l, b.b-b.t);}
        const b = pts.length ? bound(pts, 16) : {l:o.go.x, t:o.go.y, r:o.go.x, b:o.go.y};
        const w = Math.max(32, b.r-b.l), h = Math.max(32, b.b-b.t), cx = (b.l+b.r)/2, cy = (b.t+b.b)/2;
        return new Phaser.Geom.Rectangle(cx - w/2, cy - h/2, w, h);
    }

    // 點到的 prefab 實例點選框（重疊取 depth 最高）；跟工具列「錨點」無關
    _instBoxAt(wx, wy)
    {
        const hits = Object.entries(this._insts ?? {}).filter(([, o])=>o.go.active && this._instBox(o).contains(wx, wy));
        return hits.length ? hits.reduce((a, b)=>(b[1].go.depth>a[1].go.depth ? b : a)) : null;
    }

    // hover 的 prefab 實例畫淡淡的虛線點選框（沒 png 的 prefab 才看得出哪裡點得到）
    _drawInstHover(g, z)
    {
        const ptr = this.input.activePointer;
        const moving = this._drag?.inst && this._drag.dx!==undefined;
        if(this._arm || this._pan || (this._drag && !moving) || !this.input.isOver || !this.map?.map) {return;}
        const hk = moving ? [this._drag.key, this._drag.inst] : (()=>{const h = this._pickAt(ptr.worldX, ptr.worldY); return h?.inst ? [h.key, h.inst] : null;})();
        if(!hk) {return;}
        const r = this._instBox(hk[1]), d = 4/z;
        const dash = (x1, y1, x2, y2)=>{
            const n = Math.max(1, Math.floor(Math.hypot(x2-x1, y2-y1)/d));
            for(let i=0; i<n; i+=2) {g.lineBetween(x1+(x2-x1)*i/n, y1+(y2-y1)*i/n, x1+(x2-x1)*Math.min(n, i+1)/n, y1+(y2-y1)*Math.min(n, i+1)/n);}
        };
        g.lineStyle(1/z, 0xffffff, 0.6);
        dash(r.left, r.top, r.right, r.top); dash(r.right, r.top, r.right, r.bottom);
        dash(r.right, r.bottom, r.left, r.bottom); dash(r.left, r.bottom, r.left, r.top);
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
            g.lineStyle(2/z, k===this._sel ? SEL_COLOR : 0xff9933, 1).fillStyle(0x000000, 0.4)
                .fillPoints([{x, y:y-s}, {x:x+s, y}, {x, y:y+s}, {x:x-s, y}], true).strokePoints([{x, y:y-s}, {x:x+s, y}, {x, y:y+s}, {x:x-s, y}], true);
        }
        this._drawZones(g, z);
        for(const [k, o] of Object.entries(this._lights ?? {}))
        {
            if(!this._markOn('light', k)) {continue;}
            const {x, y} = this._lightPos(o), sel = k===this._sel;
            Sandbox._drawSun(g, z, x, y, o.hex, sel ? SEL_COLOR : 0x000000, (sel ? 2 : 1.5)/z);
            if(sel) {Sandbox._drawLightRange(g, z, x, y, o.light.radius, o.light.spot, SEL_COLOR);}
        }
        const s = HANDLE/z;
        for(const hd of this._sceneLightHandles())
        {
            g.fillStyle(0xffffff, 1).fillRect(hd.x-s/2, hd.y-s/2, s, s).lineStyle(1/z, 0x000000, 1).strokeRect(hd.x-s/2, hd.y-s/2, s, s);
        }
        const p = this._puppet(this._sel), o = this._props?.[this._sel];
        const r = p?.visible && p.getShapeRect ? p.getShapeRect() : o?.sp.visible ? o.sp.getBounds() : null;
        if(r)
        {
            g.lineStyle(2/z, SEL_COLOR, 1).strokeRect(r.x, r.y, r.width, r.height);
            for(const hd of this._handles()) {g.fillStyle(0xffffff, 1).fillRect(hd.x-s/2, hd.y-s/2, s, s).lineStyle(1/z, 0x000000, 1).strokeRect(hd.x-s/2, hd.y-s/2, s, s);}
        }
        // prefab 實例沒有選取框：錨點每個都畫（沒選中的半透明），點選框只在 hover 時畫
        if(this._anchorOn!==false)
        {
            for(const [k, fi] of Object.entries(this._insts ?? {})) {if(fi.go.active && k!==this._sel) {this._drawInstAnchor(g, z, fi.go, 0.5);}}
        }
        this._drawInstHover(g, z);
        const a = this._anchorPt();
        if(a) {this._insts?.[this._sel]?.go.active ? this._drawInstAnchor(g, z, a, 1) : this._drawAnchor(g, z, a, 1);}
        this._drawInspect(g, z);   // 占地方塊畫在選取框上面，重疊的邊才看得到
    }

    // 黃點黑框＋十字：錨點常壓在選取框下邊上，要跟框線分得開
    _drawAnchor(g, z, a, alpha)
    {
        const ar = 4/z, c = ar*0.6;
        g.fillStyle(0xffdd33, alpha).fillCircle(a.x, a.y, ar).lineStyle(1.5/z, 0x000000, 1).strokeCircle(a.x, a.y, ar)
            .lineStyle(1/z, 0x000000, 1).lineBetween(a.x-c, a.y, a.x+c, a.y).lineBetween(a.x, a.y-c, a.x, a.y+c);
    }

    // prefab 實例的錨點＝準星（空心圓＋穿出圓的長十字，黃線黑邊）：可以點、可以拖，跟擺設／角色的黃點分開
    _drawInstAnchor(g, z, a, alpha)
    {
        const r = 5/z, c = 9/z;
        for(const [w, col] of [[2.5/z, 0x000000], [1.5/z, 0xffdd33]])
        {
            g.lineStyle(w, col, alpha).strokeCircle(a.x, a.y, r)
                .lineBetween(a.x-c, a.y, a.x+c, a.y).lineBetween(a.x, a.y-c, a.x, a.y+c);
        }
    }

    // 選中的擺設（sprite 的 x/y）、prefab 實例或角色（root 的 x/y＝站的點）；工具列「錨點」沒勾＝null
    _anchorPt()
    {
        if(this._anchorOn===false) {return null;}
        const o = this._props?.[this._sel], p = this._puppet(this._sel), fi = this._insts?.[this._sel];
        if(o?.sp.visible) {return {x:o.sp.x, y:o.sp.y};}
        if(fi?.go.active) {return {x:fi.go.x, y:fi.go.y};}
        if(p?.visible) {return {x:p.x, y:p.y};}
        return null;
    }

    // 點到的 prefab 實例錨點（8 螢幕 px 內，重疊取 depth 最高）；工具列「錨點」沒勾＝點不到
    _instAt(wx, wy, only)
    {
        if(this._anchorOn===false) {return null;}
        const R = 8/this.cameras.main.zoom;
        const hits = Object.entries(this._insts ?? {}).filter(([k, o])=>(!only || k===only) && o.go.active && Math.hypot(o.go.x-wx, o.go.y-wy)<=R);
        return hits.length ? hits.reduce((a, b)=>(b[1].go.depth>a[1].go.depth ? b : a)) : null;
    }

    //------------------------------------------------------
    //  擺設大小把手：選中的擺設白框上 4 角＋4 邊中點（有角度不出），對邊固定；
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

    //------------------------------------------------------
    //  textures.json 更新（加了圖）：不重開，只補載沒載過的 key；之前缺圖的木偶／prefab 實例重建，其他不動
    //  同一個 key 換了內容不會換新（要按重開）
    //------------------------------------------------------
    async _reloadTex()
    {
        const tex = await (await fetch(`assets/json/textures.json?t=${Date.now()}`)).json();
        if(!this.scene.isActive()) {return;}
        const has = (k)=>this.textures.exists(k);
        const missTex = (o)=>o.texture?.key==='__MISSING' || (o.list ?? []).some(missTex);
        const stalePuppets = this.roles.filter(missTex);
        const staleInsts = Object.entries(this._insts).filter(([, o])=>(DB.prefab(o.data.prefab)?.parts ?? []).some(p=>p.img && !has(p.img.split(':')[0]))).map(([k])=>k);
        this.load.setPath('assets');
        if(!queueTextures(this.load, tex, has)) {return;}
        await new Promise((res)=>{this.load.once('complete', res); this.load.start();});
        if(!this._scene || !this.scene.isActive()) {return;}
        stalePuppets.forEach(p=>p.dismiss());
        staleInsts.forEach(k=>this._insts[k] && this._dropInst(k));
        await this._apply(this._scene);
    }

    _send(msg) {window.parent.postMessage(msg, '*');}

    _recv(m)
    {
        switch(m.sb)
        {
            case 'load':
                if(m.prefabs) {DB._prefabDB = Sandbox._pfFiles(m.prefabs);}
                if(m.particles) {DB._particleDB = m.particles;}   // particle.json＋prefab 草稿的粒子副本
                if((m.scene.map ?? 'sandbox') !== this.mapName) {this._saveCam(); this.scene.restart({map:m.scene.map, scene:m.scene, grid:this._gridOn, sel:this._sel, hidden:[...this._hidden]});}
                else {this._apply(m.scene);}
                break;
            case 'grid': this._gridOn = !!m.on; this._drawGrid(); break;
            case 'anchor': this._anchorOn = !!m.on; break;
            case 'icons': this._icons = {light:!!m.light, particle:!!m.particle}; break;
            case 'home': this._home(); break;
            case 'inspect': if(m.inspect?.key!==this._inspect?.key) {this._pzsel = null;} this._inspect = m.inspect ?? null; break;
            case 'focus': {const go = this._insts?.[m.key]?.go; if(go) {this.cameras.main.pan(go.x, go.y, 250, 'Sine.easeInOut');} break;}
            case 'select': this._sel = m.key ?? null; this._size = {lock:m.lock ?? 'pct', ratio:m.ratio ?? true}; break;
            case 'arm': this._arm = m.act ?? null; this._drawSel(); this._cursor(); break;
            case 'do': this._do(m.act); break;
            case 'replay': if(this._last) {this._do(this._last);} break;
            case 'reset': this._apply(this._scene, {force:true}); break;
            case 'textures': this._texQ = (this._texQ ?? Promise.resolve()).then(()=>this._reloadTex()).catch(e=>this._send({sb:'error', msg:`圖片清單補載失敗：${e.message}`})); break;
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
                if(this._scene) {this._applyInsts(this._scene.prefabs ?? []);}
                break;
        }
    }

    // 拉左右欄／縮放視窗時場景裡的東西在螢幕上不動：舊的左上角那個世界點對到新的同一個螢幕位置（iframe 左上角移了就扣回去）
    // CameraManager 自己也聽 resize、會先改好鏡頭大小，所以舊寬高自己記
    _onResize(size)
    {
        GM.w = size.width;
        GM.h = size.height;
        const cam = this.cameras.main, z = cam.zoom;
        const f0 = this._frame, f1 = this._frame = this._frameXY();
        const [w0, h0] = this._camWH ?? [cam.width, cam.height], {width:w1, height:h1} = size;
        const dx = f0 && f1 ? f1.x - f0.x : 0, dy = f0 && f1 ? f1.y - f0.y : 0;
        const left = cam.scrollX + w0/2 - w0/(2*z), top = cam.scrollY + h0/2 - h0/(2*z);
        cam.setSize(w1, h1);
        cam.scrollX = left + dx/z - w1/2 + w1/(2*z);
        cam.scrollY = top + dy/z - h1/2 + h1/(2*z);
        this._camWH = [w1, h1];
        this._drawGrid();
    }

    _frameXY()
    {
        try {const r = window.frameElement?.getBoundingClientRect(); return r ? {x:r.left, y:r.top} : null;}
        catch {return null;}
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
            if(rh) {this._drag = {radius:rh.o, key:this._sel, r0:rh.o.data.r ?? 120, dir0:rh.o.data.dir}; return;}
            const ah = p.leftButtonDown() && this._arcAt(p.worldX, p.worldY);
            if(ah) {this._drag = {arc:ah.o, key:this._sel, arc0:ah.o.data.arc}; return;}
            const zh = p.leftButtonDown() && this._zoneHandleAt(p.worldX, p.worldY);
            if(zh) {this._startZone(zh, p); return;}
            // 已選中的 prefab 實例：edit 方塊的把手＞edit 零件（拖零件）＞錨點或 show 零件＝拖實例，沒拖動就回報點到的零件
            const ins = p.leftButtonDown() && this._inspected();
            const bh = ins && this._boxHandleAt(p.worldX, p.worldY);
            if(bh)
            {
                const b0 = this._inspect.boxes[bh.k];
                this._drag = {box:bh.k, side:bh.side, inst:ins, key:this._sel, b0, cur:{...b0}};
                return;
            }
            const lh = ins && this._partLightHandleAt(p.worldX, p.worldY);
            if(lh)
            {
                const L = lh.light;
                this._drag = {plight:L, kind:lh.kind, i:lh.i, key:this._sel, r:L.radius, dir:L.spot?.dir, arc:L.spot?.arc};
                this._drag.v0 = JSON.stringify(Sandbox._partLightVals(this._drag));
                return;
            }
            // 選中 zone 的把手＞edit 粒子／光源點＞錨點＞zone 框線＞edit png 圖框＞選中 zone 的框內
            const pzh = ins && this._pzHandleAt(p.worldX, p.worldY);
            if(pzh) {this._startPartZone(pzh, p); return;}
            const ei = ins ? this._partAt(ins, p.worldX, p.worldY) : null;
            const pp = ei!==null && DB.prefab(ins.data.prefab).parts[ei];
            const dragPart = ()=>{
                // 前後片（同 pair）一起拖
                const parts = DB.prefab(ins.data.prefab)?.parts ?? [], sel0 = (this._inspect.partSel ?? []).filter(j=>this._partSel(j));
                const pairs = new Set(sel0.map(j=>parts[j]?.pair).filter(v=>v!==undefined));
                const sel = [...new Set([...sel0, ...parts.map((q, j)=>(pairs.has(q.pair) && !q.off ? j : -1)).filter(j=>j>=0)])];
                this._drag = {p:pp, part:ei, sel, inst:ins, key:this._sel, x:pp.x ?? 0, y:pp.y ?? 0, ox:ins.go.x + (pp.x ?? 0) - p.worldX, oy:ins.go.y + (pp.y ?? 0) - p.worldY, moved:false};
                this._cursor(p);
            };
            if(pp && !pp.img) {dragPart(); return;}
            if(ins && this._instAt(p.worldX, p.worldY, this._sel))
            {
                this._drag = {inst:ins, key:this._sel, dx:ins.go.x-p.worldX, dy:ins.go.y-p.worldY, moved:false};
                this._cursor(p);
                return;
            }
            const pze = ins && this._pzBodyAt(p.worldX, p.worldY, true);
            if(pze) {this._startPartZone(pze, p); this._cursor(p); return;}
            if(pp) {dragPart(); return;}
            const pzb = ins && this._pzBodyAt(p.worldX, p.worldY);
            if(pzb) {this._startPartZone(pzb, p); this._cursor(p); return;}
            const hit = this._pickAt(p.worldX, p.worldY);
            if(p.rightButtonDown())
            {
                this._send({sb:'ctx', tx, ty, wx:Math.round(p.worldX), wy:Math.round(p.worldY), key:hit?.key ?? null, cx:p.event.clientX, cy:p.event.clientY});
                return;
            }
            // zone 框線蓋過角色／擺設（記號除外）；框內要沒點到別的東西才輪到 zone 本體（大片的 zone 不擋底下的角色）
            const zb = !hit?.emitter && !hit?.light && this._zoneBodyAt(p.worldX, p.worldY, true)
                || !hit && this._zoneBodyAt(p.worldX, p.worldY);
            if(zb) {this._startZone(zb, p); this._cursor(p); return;}
            this._sel = hit?.key ?? null;
            this._send({sb:'select', key:this._sel});
            if(hit?.role) {this._drag = {role:hit.role, from:this.map.worldToTile(hit.role.x, hit.role.y), to:null};}
            else if(hit?.prop) {this._drag = {prop:hit.prop, key:hit.key, dx:hit.prop.sp.x-p.worldX, dy:hit.prop.sp.y-p.worldY, moved:false};}
            else if(hit?.inst) {this._drag = {inst:hit.inst, key:hit.key, dx:hit.inst.go.x-p.worldX, dy:hit.inst.go.y-p.worldY, moved:false};}
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
            else if(this._drag?.box)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                const d = this._drag;
                this._boxTo(d, p.worldX, p.worldY, p.event.shiftKey);
                this._send({sb:'dragLive', key:d.key, k:d.box, side:d.side, box:d.cur, start:!d.live});
                d.live = true;
            }
            else if(this._drag?.p)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                // 零件位置相對錨點；Shift 吸 16px（世界座標）
                const go = this._drag.inst.go;
                let x = p.worldX + this._drag.ox, y = p.worldY + this._drag.oy;
                [x, y] = p.event.shiftKey ? [x, y].map(v=>Math.round(v/16)*16) : [x, y].map(Math.round);
                const d = this._drag;
                this._placePart(d, x - go.x, y - go.y);
                this._send({sb:'dragLive', key:d.key, part:d.part, x:d.x, y:d.y, start:!d.live});
                d.live = true;
            }
            else if(this._drag?.plight)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                const d = this._drag;
                this._partLightTo(d, p.worldX, p.worldY, p.event.shiftKey);
                this._send({sb:'dragLive', key:d.key, part:d.i, light:Sandbox._partLightVals(d), start:!d.live});
                d.live = true;
            }
            else if(this._drag?.radius)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                this._radiusTo(this._drag, p.worldX, p.worldY, p.event.shiftKey);
            }
            else if(this._drag?.arc)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                this._arcTo(this._drag, p.worldX, p.worldY, p.event.shiftKey);
            }
            else if(this._drag?.zone)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                this._zoneTo(this._drag, p);
            }
            else if(this._drag?.pzone)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                this._partZoneTo(this._drag, p);
            }
            else if(this._drag?.prop || this._drag?.emitter || this._drag?.light || this._drag?.inst)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                // 自由拖；按住 Shift 錨點吸到 16px（格子交點＋格子中心）
                let x = p.worldX + this._drag.dx, y = p.worldY + this._drag.dy;
                if(p.event.shiftKey) {[x, y] = [x, y].map(v=>Math.round(v/16)*16);}
                else {[x, y] = [x, y].map(Math.round);}
                this._drag.moved = true;
                if(this._drag.prop) {this._placeProp(this._drag.prop, x, y);}
                else if(this._drag.inst) {this._placeInst(this._drag.inst, x, y);}
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
        if(d?.resize || d?.radius || d?.arc || d?.plight || d?.box || ((d?.zone || d?.pzone) && d.part!=='move') || !this._props) {return;}
        let c = '';
        if(this._arm) {c = 'crosshair';}
        else if(d || this._pan) {c = 'grabbing';}
        else
        {
            const hd = this._handleAt(p.worldX, p.worldY), zh = !hd && this._zoneHandleAt(p.worldX, p.worldY);
            const bh = !hd && !zh && this._inspected() && this._boxHandleAt(p.worldX, p.worldY);
            const lh = !hd && !zh && !bh && this._inspected() && this._partLightHandleAt(p.worldX, p.worldY);
            const pz = !hd && !zh && !bh && !lh && this._inspected() && (this._pzHandleAt(p.worldX, p.worldY) || this._pzBodyAt(p.worldX, p.worldY, true));
            const pk = !hd && !zh && !bh && !lh && !pz && this._pickAt(p.worldX, p.worldY);
            c = hd ?(!hd.hy ? 'ew-resize' : !hd.hx ? 'ns-resize' : hd.hx*hd.hy>0 ? 'nwse-resize' : 'nesw-resize')
                : zh ? ZONE_CURSOR[zh.part]
                : bh ? (bh.side==='l' || bh.side==='r' ? 'ew-resize' : 'ns-resize')
                : lh ? 'pointer'
                : pz ? ZONE_CURSOR[pz.part]
                : this._radiusAt(p.worldX, p.worldY) || this._arcAt(p.worldX, p.worldY) ? 'pointer'
                : !pk?.emitter && !pk?.light && this._zoneBodyAt(p.worldX, p.worldY, true) ? 'move'
                : pk?.inst ? 'move'
                : pk ? 'grab'
                : this._zoneBodyAt(p.worldX, p.worldY) ? 'move' : '';
        }
        this.game.canvas.style.cursor = c;
    }

    // 角色永遠站格子中心；放開才回報，場景分頁寫檔後送回來的資料一變就重建（重新登記路網權重）
    _endDrag()
    {
        const d = this._drag;
        this._drag = null;
        if(d?.live) {this._send({sb:'dragLive', key:d.key, end:true});}
        if(d?.box)
        {
            if(JSON.stringify(d.cur)!==JSON.stringify(d.b0))
            {
                this._inspect.boxes[d.box] = d.cur;   // 等分頁寫進草稿送回來之前先照新的畫
                this._send({sb:'box', key:d.key, k:d.box, box:d.cur});
            }
            return;
        }
        if(d?.p)
        {
            const dx = d.x - (d.p.x ?? 0), dy = d.y - (d.p.y ?? 0), parts = DB.prefab(d.inst.data.prefab)?.parts ?? [];
            if(d.moved && (dx || dy)) {this._send({sb:'moveParts', key:d.key, moves:d.sel.map(i=>({i, x:(parts[i].x ?? 0) + dx, y:(parts[i].y ?? 0) + dy}))});}
            else if(!d.moved) {this._send({sb:'part', key:d.key, i:d.part});}
            return;
        }
        if(d?.plight)
        {
            const v = Sandbox._partLightVals(d);
            if(JSON.stringify(v)!==d.v0) {this._send({sb:'partLight', key:d.key, i:d.i, patch:v});}
            return;
        }
        if(d?.resize)
        {
            if(d.patch) {this._send({sb:'resizeProp', key:d.key, patch:d.patch});}
            return;
        }
        if(d?.radius)
        {
            const dir = d.dir!==undefined && d.dir!==(d.dir0 ?? 0) ? {dir:d.dir} : {};
            if(d.r!==undefined && (d.r!==d.r0 || dir.dir!==undefined)) {this._send({sb:'radiusLight', key:d.key, r:d.r, ...dir});}
            return;
        }
        if(d?.arc)
        {
            if(d.v!==undefined && d.v!==d.arc0) {this._send({sb:'arcLight', key:d.key, arc:d.v});}
            return;
        }
        if(d?.zone)
        {
            if(d.cur && JSON.stringify(d.cur)!==JSON.stringify(d.z0)) {this._send({sb:'zone', key:d.key, k:d.zone, z:d.cur});}
            return;
        }
        if(d?.pzone)
        {
            if(d.cur && JSON.stringify(d.cur)!==JSON.stringify(d.z0)) {this._send({sb:'partZone', key:d.key, i:d.i, k:d.pzone, z:d.cur});}
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
        if(d?.inst)
        {
            const {x, y} = d.inst.go;
            if(d.moved && (x!==d.inst.data.x || y!==d.inst.data.y)) {this._send({sb:'moveInst', key:d.key, x, y});}
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
