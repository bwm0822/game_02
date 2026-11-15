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

// 開發版的 gym 場景：工具殼「場景」分頁的 iframe 跑 /?sandbox，用 postMessage 操作（訊息帶 sb 欄位，見 docs/scene-tool.md）
// 繼承 GameScene 拿真的地圖／路網／Light2D，但沒有玩家、UI、回合、作息、劇情；地圖只建地形＋靜態物件，不寫存檔
const ZOOM = [0.25, 8];
const GRID_DEPTH = 1e7;

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

    update() {this._drawSel();}

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
        this.lights.enable();
        this.lights.setAmbientColor(0xffffff);
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
        this._drawGrid();
        this._initInput();
        if(import.meta.env.DEV) {window.__sb = this;}
        if(this._data.scene) {this._apply(this._data.scene);}
        else {this._send({sb:'ready', map:this.mapName});}
    }

    // 場景分頁送來的場景（tools/scenes.json 的一筆）；換底圖要整個重開
    // 角色照 key 比對：資料一樣的留著（表演到一半不打斷），不一樣或 force（重置）就重建
    _apply(scene, {force=false}={})
    {
        this._scene = scene;
        // 重置：表演生出來的東西（火牆區域、屍體…）一起清掉；地圖本身的物件 uid 不是 -1
        if(force) {Object.values(this.gos).filter(g=>g.uid===-1 && g.active).forEach(g=>g._remove());}
        const want = Object.fromEntries((scene.roles ?? []).map(r=>[r.key, r]));
        for(const p of [...this.roles])
        {
            if(force || !want[p.key] || JSON.stringify(want[p.key])!==p._sig) {p.dismiss();}
        }
        const bad = [];
        for(const r of scene.roles ?? [])
        {
            if(!this.roles.some(p=>p.key===r.key) && !this._spawn(r)) {bad.push(r.id);}
        }
        if(bad.length) {this._send({sb:'error', msg:`role.json 沒有：${[...new Set(bad)].join('、')}`});}
        this._send({sb:'loaded', map:this.mapName, w:this.map.map.width, h:this.map.map.height});
    }

    _spawn(r)
    {
        const pt = this.map.tileToWorld(r.tx, r.ty);
        const p = new Puppet(this, pt.x, pt.y);
        if(!p.init_runtime(r)) {p.destroy(); return null;}
        p._sig = JSON.stringify(r);
        p.setVisible(!this._hidden.has(r.key));
        return p;
    }

    _puppet(key) {return this.roles.find(p=>p.key===key);}

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
        const p = this._puppet(this._sel);
        if(!p?.visible || !p.getShapeRect) {return;}
        const r = p.getShapeRect();
        g.lineStyle(2/z, 0x7ddc5a, 1).strokeRect(r.x, r.y, r.width, r.height);
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
            case 'home': this._home(); break;
            case 'select': this._sel = m.key ?? null; break;
            case 'arm': this._arm = m.act ?? null; this._drawSel(); break;
            case 'do': this._do(m.act); break;
            case 'replay': if(this._last) {this._do(this._last);} break;
            case 'reset': this._apply(this._scene, {force:true}); break;
            case 'hit': this._puppet(m.key)?.anim_hit?.(null); break;
            case 'die': this._puppet(m.key)?.die(); break;
            case 'revive': this._puppet(m.key)?.revive(); break;
            case 'hide':
                this._hidden = new Set(m.keys);
                this.roles.forEach(p=>p.setVisible(!this._hidden.has(p.key)));
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
            if(p.middleButtonDown()) {this._pan = {x:p.x, y:p.y, sx:cam.scrollX, sy:cam.scrollY}; return;}
            const role = this._roleAt(p.worldX, p.worldY);
            const [tx, ty] = this.map.worldToTile(p.worldX, p.worldY);
            if(p.rightButtonDown())
            {
                if(this._arm) {this._arm = null; this._send({sb:'disarm'}); return;}
                this._send({sb:'ctx', tx, ty, key:role?.key ?? null, cx:p.event.clientX, cy:p.event.clientY});
                return;
            }
            // 指定目標中：左鍵＝對那格／那個角色做動作（右鍵或 Esc 取消）
            if(this._arm) {this._do({...this._arm, tx, ty, tkey:role?.key ?? null}); return;}
            this._sel = role?.key ?? null;
            this._send({sb:'select', key:this._sel});
            if(role) {this._drag = {role, from:this.map.worldToTile(role.x, role.y), to:null};}
        });
        this.input.on('pointermove', (p)=>{
            if(this._pan)
            {
                if(!p.middleButtonDown()) {this._pan = null; return;}
                cam.scrollX = this._pan.sx - (p.x-this._pan.x)/cam.zoom;
                cam.scrollY = this._pan.sy - (p.y-this._pan.y)/cam.zoom;
            }
            else if(this._drag?.role.active)
            {
                if(!p.leftButtonDown()) {this._endDrag(); return;}
                const [tx, ty] = this.map.worldToTile(p.worldX, p.worldY);
                if(!this.map.isInside(tx, ty)) {return;}
                const pt = this.map.tileToWorld(tx, ty);
                this._drag.to = [tx, ty];
                this._drag.role.setPosition(pt.x, pt.y).updateDepth();
            }
        });
        this.input.on('pointerup', ()=>{this._pan = null; this._endDrag();});
        // iframe 有焦點時鍵盤在這裡：交給場景分頁（Del、Ctrl+Z…）
        const onKey = (e)=>this._send({sb:'key', key:e.key, ctrl:e.ctrlKey || e.metaKey, shift:e.shiftKey, alt:e.altKey});
        addEventListener('keydown', onKey);
        this.events.once('shutdown', ()=>removeEventListener('keydown', onKey));
    }

    // 角色永遠站格子中心；放開才回報，場景分頁寫檔後送回來的資料一變就重建（重新登記路網權重）
    _endDrag()
    {
        const d = this._drag;
        this._drag = null;
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
