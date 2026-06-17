import {Scene} from 'phaser'
import Map from '../manager/map.js'
import Record from '../infra/record.js'
import QuestManager from  '../manager/quest.js'
import Pickup from '../items/pickup.js'
import {GM,UI,OCCLUDE_TBL} from '../core/setting.js'
import {DEBUG,T,dlog} from '../core/debug.js'
import Ui from '../ui/uicommon.js'
import UiMark from '../ui/uimark.js'
import UiCursor from '../ui/uicursor.js'
import TimeSystem from '../systems/time.js'
import AudioManager from '../manager/audio.js'
import {GameObject} from '../core/gameobject.js'
import {MiniMap} from '../manager/minimap.js'


export class GameScene extends Scene
{
    constructor (name)
    {
        super(name);
    }

    init(data) 
    {
        dlog(T.SCENE)('[1] init');
        this._data = data;
    }

    update()
    {
        this.cameraMove();
        this._refreshCursor();
        this._checkOcclusion();
    }

    _checkOcclusion()
    {
        if(!GM.player) {return;}
        const player = GM.player;
        const hw = GM.TILE_W * 3;
        const hh = GM.TILE_H * 3;

        const allGos = [...Object.values(this.gos), ...this.roles];

        const nearby = allGos.filter(go =>
            Math.abs(go.x - player.x) <= hw &&
            Math.abs(go.y - player.y) <= hh &&
            go.occludeType !== GM.OCCLUDE.NONE
        );

        // Reset all objects first
        for(const go of allGos) { go.setOcclude(false); }

        // For each nearby occludee, find the occluder covering it and make the OCCLUDER semi-transparent
        for(const go of nearby)
        {
            // const view = go.coms.view;
            const occluderMask = OCCLUDE_TBL[go.occludeType];
            if(occluderMask===GM.OCCLUDE.NONE) {continue;}

            const rect = go.getShapeRect();

            for(const t of nearby)
            {
                if(!(occluderMask&t.occludeType)) {continue;}

                if(t === go || t.depth >= go.depth) {continue;}
                if(rect.contains(t.x, t.y)) { go.setOcclude(true); }
                
            }
        }
    }

    _refreshCursor()
    {
        if(this._atEdge) {return;}
        if(GM.player?.sta === GM.ST.ABILITY) {return;}
        if(!this._ent) {return;}

        const act = this._ent.act;
        if(act !== this._lastAct)
        {
            this._lastAct = act;
            UiCursor.set(act);
        }
    }

    async create ({diagonal,classType,weight})
    {
        dlog(T.SCENE)('[2] create')
        this._dbgPos = null;
        this._graphics = null;
        this._dbgPath = null;
        this._pos = null;
        this._act = 'go';
        this._ent = null;
        this._lastAct = null;
        this.roles = [];
        // this.entities = [];
        GameObject.gid=0;
        this.gos = {};
        this.loadRecord();
        this.setEvent();
        this.initUI();
        this.initAmbient(this._data.ambient);

        await new Map(this).createMap(this._data.map, diagonal, weight);
        await MiniMap.init(this);
        this.createRuntime();
        this.setPosition(classType);
        this.initSchedule();
        this.processInput();

        AudioManager.init(this);
        TimeSystem.start();
        Ui.get(UI.TAG.MESSAGE).clean();
        Ui.get(UI.TAG.CHANGESCENE).done();
        AudioManager.bgmStart();

        this.log();
    }

    log()
    {
        dlog(T.SCENE)("Roles:", this.roles);
        // dlog(T.SCENE)("Entities:", this.entities);
        dlog(T.SCENE)("gos:", this.gos);
    }

    initAmbient(amb)
    {
        this.lights.enable();
        if(amb) {this.lights.setAmbientColor(parseInt(amb));}
        else {TimeSystem.register(this.setAmbient.bind(this));}
    }

    setAmbient(dt,time)
    {
        this.lights.setAmbientColor(this.getAmbientColor(time));
    }

    getAmbientColor(time)
    {
        return 0x808080;
    }

    createRuntime()
    {
        let objs = Record.game.scenes?.[this._data.map]?.runtime;
        if(objs)
        {
            objs.forEach((obj)=>{
                const cls = Map.classMap[obj.class];
                if(cls) {new cls(this,obj.x,obj.y).init_runtime(obj);}
            });
            Record.game.scenes[this._data.map].runtime = [];
        }
    }

    loadRecord()
    {
        QuestManager.load();
        TimeSystem.load();
        //Role.Player.load();
    }

    initSchedule()
    {
        // define in GameArea.js
    }

    cameraMove()
    {
        if(this._atEdge)
        {
            this.cameras.main.scrollX += this._mv.x;
            this.cameras.main.scrollY += this._mv.y;
        }
    }

    cameraPan()
    {
        this.cameras.main.pan(GM.player.x, GM.player.y, 100, 'Power2');
        // pan 結束後再開始跟隨
        this.cameras.main.once('camerapancomplete', () => {
            this.setCameraFollow(GM.CAM_CENTER);
        });
    }

    isMouseAtEdge(pointer)
    {
        const p = pointer;
        const m = 5;
        const atEdge = p.x<=m||p.x>=GM.w-m||p.y<=m||p.y>=GM.h-m;
        const d = 3.5;

        if(atEdge && GM.player.sta!==GM.ST.MOVING)
        {
            // console.log('--------------- edge:',p.x,p.y)
            this._mv = {x : p.x<GM.w*0.2 ? -d :
                            p.x>GM.w*0.8 ? d : 0, 
                        y : p.y<GM.h*0.2 ? -d :
                            p.y>GM.h*0.8 ? d : 0};

            if(!this._atEdge)
            {
                this._atEdge=true;
                this._atEdge=true;
                this._path=null;
                this.stopCameraFollow();
                this.clearPath();
                UiCursor.set('cross');
            }
        }
        else if(this._atEdge)
        {
            this._atEdge=false;
            UiCursor.set('none');
        }

        return this._atEdge;
    }

    stopCameraFollow()
    {
        this._follow=false;
        this.cameras.main.stopFollow();
    }

    setCameraFollow(mode)
    {
        this._follow=true;
        dlog(T.SCENE)('setCameraFollow:',mode)
        let offsetX=0,offsetY=0;
        if((mode&GM.CAM_LEFT_TOP)==GM.CAM_LEFT_TOP) {mode=GM.CAM_LEFT_TOP;}
        else {mode&=~GM.CAM_LEFT_TOP;}
        
        switch(mode)
        {
            case GM.CAM_CENTER: 
                offsetX = 0; offsetY = 0; break;
            case GM.CAM_LEFT: 
                offsetX = -this.cameras.main.width/4; offsetY = 0; break;
            case GM.CAM_RIGHT: 
                offsetX = this.cameras.main.width/4; offsetY = 0; break;
            case GM.CAM_LEFT_TOP:
                offsetX = -this.cameras.main.width/4;
                offsetY = this.map.small ? 0 : -this.cameras.main.width/4; break;
            case GM.CAM_TOP:
                offsetX = 0; offsetY = -this.cameras.main.height/3; break;
            case GM.CAM_BOTTOM:
                offsetX = 0; offsetY = this.cameras.main.height/3; break;
            default:
                offsetX = 0; offsetY = 0; break;
        }

    
        if(this.map.small)
        {
            this.cameras.main.centerOn(this.map.center.x-offsetX,this.map.center.y-offsetY);
        }
        else
        {
            this.cameras.main.startFollow(GM.player,true,0.01,0.01,offsetX,offsetY);
        }
      
    }

    setPosition(classType)
    {
        let pos;
        if(this._data.pos) {pos = this._data.pos}
        else {
            dlog(T.SCENE)('----- port=',this._data.port)
            dlog(T.SCENE)(this.gos)
            // pos = this.gos[this._data.port].pts[0];
            pos = this.gos[this._data.port].getPts(GM.player)[0];
        }

        dlog(T.SCENE)('------------ pos=',pos)
        new classType(this,pos.x,pos.y).init_runtime('wick').load();

        this.setCameraFollow(GM.CAM_CENTER);
 
        Record.game.pos = GM.player.pos;   
        Record.game.map = this._data.map;
        Record.game.ambient = this._data.ambient;
        Record.saveGame();
    }

    initUI() 
    {
        UiCursor.set();
        new UiMark(this);
    }

    processInput()
    {    
        this.input
        .on('pointerdown', (pointer)=>{
            this.onPointerDown(pointer);
            // console.log('game down')
        })
        .on('pointermove',(pointer)=>{
            this.onPointerMove(pointer);
            // console.log('game move:',pointer.x,pointer.y,pointer.worldX,pointer.worldY)
        })

        //this.keys = this.input.keyboard.createCursorKeys();
        //this.input.keyboard.on('keydown',()=>{this.keyin();})
    }

    onPointerDown(pointer,gameObject)
    {        
        if(GM.player.sta===GM.ST.SLEEP) {return;}

        if (pointer.rightButtonDown())
        {
            dlog(T.SCENE)('right');
        }
        else if (pointer.middleButtonDown())
        {
            dlog(T.SCENE)('middle');
        }
        else
        {
            let pt = {x:pointer.worldX, y:pointer.worldY};
            if(Ui.mode===UI.MODE.PLACE)
            {
                this.doPlace(pt);
            }
            else if(GM.player.sta===GM.ST.MOVING)
            {
                GM.player.stop();
            }
            else if(GM.player.sta===GM.ST.ABILITY)
            {
                GM.player.cmd({pt:pt,ent:this._ent});
            }
            else if(this._path?.state===GM.PATH_OK)
            {
                if(!this._follow) {this.cameraPan(pt);}
                GM.player.cmd({pt:pt,ent:this._ent,path:this._path});
                UiMark.close();
                // this._path=null;
            }
        }
    }

    onPointerMove(pointer)
    {
        if(Record.setting.mouseEdgeMove&&this.isMouseAtEdge(pointer))
        {
            return;
        }

        if(DEBUG.loc) {this.showMousePos();}
        if(Ui.mode===UI.MODE.PLACE)
        {
            const pt = {x:pointer.worldX, y:pointer.worldY};
            UiCursor.instance.setIcon(this.isPlaceable(pt) ? 'aim' : 'close');
            return;
        }
        if(GM.player.sta===GM.ST.ABILITY)
        {
            let pt = {x:pointer.worldX,y:pointer.worldY};
            if(GM.player.isInRange(pt)) {UiCursor.set('aim');}
            else {UiCursor.set('none');}
            return;
        }
        else if(GM.player.sta===GM.ST.SLEEP) {return;}
        else if(GM.player.sta===GM.ST.IDLE)
        {
            const ep = {x:pointer.worldX,y:pointer.worldY};
            this.showPath(ep, this._ent);
        }
    }

    keyin()
    {
        let mx=0,my=0
        if(this.keys.left.isDown){mx--;}
        if(this.keys.right.isDown){mx++;}
        if(this.keys.up.isDown){my--;}
        if(this.keys.down.isDown){my++;}
        if(mx!=0||my!=0)
        {
            GM.player.stepMove(mx,my);
            this.clearPath();
        }
    }

    showPath(ep, ent)
    {
        if(ent===GM.player) {this._path=null; return;}
        // const pts = ent?.pts ?? [pt];
        // const pts = ent?.getPts(GM.player) ?? [pt];
        // const path = GM.player.showPath(pts,ent);
        const path = GM.player.showPath({ep,ent});
        if(path)
        {
            if(path.state===GM.PATH_OK)
            {
                if(this._ent) {UiMark.close();}
                else {UiMark.show(path.ep,GM.COLOR.WHITE);}
            }
            else
            {
                UiMark.show(path.ep,GM.COLOR.RED);
            }
        }
        else
        {
            UiMark.close();
        }

        this._path = path;
    }

    clearPath()
    {
        // console.log('clearpath')
        GM.player?.hidePath();
        UiMark.close();
        UiCursor.set(); 
    }

    npcPath(on) 
    {
        this.roles.forEach(role=>{
            if(role.isPlayer) {return;}
            if(on) {role.updateDebugPath();}
            else  {role.hidePath();}
        });
    }

    save()
    {
        Record.game.pos = GM.player.pos;   
        if(Record.game[this._data.map]?.runtime) {Record.game[this._data.map].runtime = [];}
        // console.log('gos:',this.gos)
        // this.gos.forEach(go=>go.save?.())
        Object.values(this.gos).forEach(go=>go.save?.())
        this.roles.forEach(role=>role.save())
        TimeSystem.save();
        Record.saveGame();
    }

    mainMenu()
    {
        dlog(T.SCENE)('------------------------ mainMenu')
        this.save();
        this.scene.stop('UI');
        this.scene.start('MainMenu');
        AudioManager.bgmPause();
        Ui.reset();
    }

    restart()
    {
        dlog(T.SCENE)('------------------------ restart')
        Record.delete();
        this.scene.stop('UI');
        this.scene.start('MainMenu');
        AudioManager.bgmPause();
        Ui.reset();
    }

    gotoScene(config)
    {
        this.save();
        Ui.closeAll(GM.UI_ALL);
        this.scene.start(config.map=='map'?'GameMap':'GameArea',config);
    }

    gameOver()
    {
        this.clearPath()
        this.input.keyboard.off('keydown');
        Ui.on(UI.TAG.GAMEOVER);
    }

    showMousePos()
    {
        if(!this._dbgPos)
        {
            this._dbgPos = this.add.text(0,0,'',{fontSize:'16px',color:'#fff',stroke:'#000',strokeThickness:3});
            this._dbgPos.setDepth(Infinity);
        }

        const x = this.input.activePointer.worldX;
        const y = this.input.activePointer.worldY;
        const w = this.map.getWeight({x:x,y:y});
        const w2 = this.map.getWeight({x:x,y:y},{tw:2,th:1});
        const text = `${x.toFixed(0)},${y.toFixed(0)},(${w},${w2})`;
        this._dbgPos.setPosition(x+20,y).setText(text);
    }

    // dbg()
    // {
    //     if(!this._dbg)
    //     {
    //         this._dbg = this.add.graphics();
    //         this._dbg.name = 'dbg';
    //     }
    //     this._dbg.clear();
    //     this._dbg.fillStyle(0xff0000);
    //     this._dbg.lineStyle(2, 0xff0000, 1);
    //     let x = this.input.activePointer.worldX;
    //     let y = this.input.activePointer.worldY;
    //     let circle = new Phaser.Geom.Circle(x,y,5);
    //     this._dbg.strokeCircleShape(circle);
    // }

    dbgRect()
    {
        Object.values(this.gos).forEach(go=>{go.debugDraw({clr:!DEBUG.rect})})
    }

    fill()
    {
        Ui.on(UI.TAG.INV,GM.player,[{p:GM.CAPACITY}]);
        UiCursor.set('aim');
        Ui.on(UI.TAG.COVER)
        Ui.setMode(UI.MODE.FILL)
    }

    enterPlaceMode(dat, ent)
    {
        this._placeData = {dat, ent};
        Ui.setMode(UI.MODE.PLACE);
        UiCursor.instance.setIcon('aim');
        this._onPlaceEsc = ()=>{this.exitPlaceMode();};
        this.input.keyboard.on('keydown-ESC', this._onPlaceEsc);
    }

    exitPlaceMode()
    {
        this.input.keyboard.off('keydown-ESC', this._onPlaceEsc);
        delete this._onPlaceEsc;
        delete this._placeData;
        Ui.setMode(UI.MODE.NORMAL);
        UiCursor.set();
    }

    isPlaceable(pt)
    {
        if(this.map.getWeight(pt) !== GM.W.EMPTY) {return false;}
        const [tx, ty] = this.map.worldToTile(pt.x, pt.y);
        const [px, py] = this.map.worldToTile(GM.player.x, GM.player.y);
        return Math.abs(tx - px) <= 1 && Math.abs(ty - py) <= 1;
    }

    doPlace(pt)
    {
        if(!this.isPlaceable(pt)) {return;}
        const {dat, ent} = this._placeData;
        console.log('class:', dat.device.class);
        const cls = Map.classMap[dat.device.class];
        if(!cls) {return;}
        console.log('chk');
        const [tx, ty] = this.map.worldToTile(pt.x, pt.y);
        const cx = this.map.map.tileToWorldX(tx) + this.map.map.tileWidth  / 2;
        const cy = this.map.map.tileToWorldY(ty) + this.map.map.tileHeight / 2;
        new cls(this, cx, cy).init_runtime({id: dat.device.id});
        ent.empty();
        Ui.refreshAll();
        this.exitPlaceMode();
    }

    setEvent()
    {      
        // 切換場景時，this.events 不會被清除，所以設過後就無須再設
        if(!this._done)
        {
            this._done = true;
            this.events
                .on('over', (ent)=>{this._ent=ent;UiCursor.set(this._ent.act);UiMark.close();})
                .on('out', ()=>{this._ent=null;this._lastAct=null;UiCursor.set();})
                .on('storage', (owner)=>{Ui.on(UI.TAG.STORAGE,owner);})
                .on('talk', (owner)=>{Ui.on(UI.TAG.DIALOG,owner);})
                .on('trade', (owner)=>{Ui.on(UI.TAG.TRADE,owner);})
                .on('steal', (owner)=>{Ui.on(UI.TAG.STEAL,owner);})
                .on('option', (x,y,acts,owner)=>{Ui.on(UI.TAG.OPTION,x,y,acts,owner)})
                .on('refresh', ()=>{Ui.refreshAll()})
                .on('msg', (msg)=>{Ui.get(UI.TAG.MESSAGE).push(msg);})
                .on('scene', (config)=>{Ui.get(UI.TAG.CHANGESCENE).start(()=>{this.gotoScene(config);})})
                .on('gameover',()=>{this.gameOver();})
                .on('stove',(owner)=>{Ui.on(UI.TAG.MANUFACTURE,owner);})
                .on('clearpath',()=>{this.clearPath();})
                .on('fill',()=>{this.fill();})
                .on('place',(dat,ent)=>{this.enterPlaceMode(dat,ent);})
        }

        // 切換場景時，events 不會被清除，所以重設時，須先清除之前的設定
        const ui = this.scene.get('UI');
        ui.events
            .off('menu').on('menu', ()=>{this.mainMenu();})
            .off('save').on('save', ()=>{this.save();})
            .off('restart').on('restart', ()=>{this.restart();})
            .off('goto').on('goto',(pos,act)=>{this.setDes(pos,act);})
            .off('camera').on('camera',(mode)=>{this.setCameraFollow(mode)})
            .off('clearpath').on('clearpath',()=>{this.clearPath();})
            .off('setWeight').on('setWeight',(p,weight)=>{this.map.setWeight(p,weight)})
            .off('log').on('log',()=>{this.log();})
            .off('dbgRect').on('dbgRect',()=>{this.dbgRect();})
            .off('npcPath').on('npcPath',(on)=>{this.npcPath(on);})

    }

}