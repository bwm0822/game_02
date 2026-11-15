import { GameScene } from './GameScene.js'
import { loadData } from './MainMenu.js'
import Map from '../manager/map.js'
import Record from '../infra/record.js'
import TimeSystem from '../systems/time.js'
import Utility from '../core/utility.js'
import {GameObject} from '../core/gameobject.js'
import {GM, GS} from '../core/setting.js'

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

    update() {}

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
        this._gridOn = this._data.grid ?? true;
        this._drawGrid();
        this._initInput();
        if(import.meta.env.DEV) {window.__sb = this;}
        if(this._data.scene) {this._apply(this._data.scene);}
        else {this._send({sb:'ready', map:this.mapName});}
    }

    // 場景分頁送來的場景（tools/scenes.json 的一筆）；換底圖要整個重開
    _apply(scene)
    {
        this._scene = scene;
        this._send({sb:'loaded', map:this.mapName});
    }

    _send(msg) {window.parent.postMessage(msg, '*');}

    _recv(m)
    {
        switch(m.sb)
        {
            case 'load':
                if((m.scene.map ?? 'sandbox') !== this.mapName) {this._saveCam(); this.scene.restart({map:m.scene.map, scene:m.scene, grid:this._gridOn});}
                else {this._apply(m.scene);}
                break;
            case 'grid': this._gridOn = !!m.on; this._drawGrid(); break;
            case 'home': this._home(); break;
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
            if(p.middleButtonDown()) {this._pan = {x:p.x, y:p.y, sx:cam.scrollX, sy:cam.scrollY};}
        });
        this.input.on('pointermove', (p)=>{
            if(!this._pan) {return;}
            if(!p.middleButtonDown()) {this._pan = null; return;}
            cam.scrollX = this._pan.sx - (p.x-this._pan.x)/cam.zoom;
            cam.scrollY = this._pan.sy - (p.y-this._pan.y)/cam.zoom;
        });
        this.input.on('pointerup', ()=>{this._pan = null;});
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
