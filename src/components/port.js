import Com from './com.js'
import {GM,UI} from '../core/setting.js'
import TimeSystem from '../systems/time.js'
import {uPanel, uPic} from '../ui/uicomponents.js'
import UiInfo from '../ui/uiinfo.js'
import UiMark from '../ui/uimark.js'

function uTag(scene,{x,y,icon='buffs:1',w=40,h=40,ext}={})
{
    const tag = uPic(scene,{x:x,y:y,icon:icon,w:w,h:h,bg:{}})
    if(this&&this.add) {this.add(tag,ext);}
    tag.qs=[];
    tag.setInteractive()
        .on('pointerover',()=>{
            UiMark.setEn(false);
            UiInfo.show(UI.INFO.NODE,tag,scene.cameras.main);
        })
        .on('pointerout',()=>{
            UiMark.setEn(true);
            UiInfo.close();
        })
    tag.add=(q)=>{tag.qs.push(q);}
    return tag;
}

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : port
// 功能 : 
//  提供傳送門功能
//--------------------------------------------------
export class COM_Port extends Com
{
    get tag() {return 'port';}  // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _enter()
    {
        TimeSystem.inc();
        const {bb,send}=this.ctx;
        send('scene',{map:bb.map, port:bb.port, ambient:bb.ambient});
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        super.bind(root);

        // 1.提供 [外部操作的指令]
        root._setAct(GM.ENTER, ()=>GM.EN);

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用

        // 3.註冊(event)給其他元件或外部呼叫
        // 外部
        root.on(GM.ENTER, this._enter.bind(this));
    }
}

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : node
// 功能 : 
//  地圖的節點
//--------------------------------------------------
export class COM_Node extends COM_Port
{
    get tag() {return 'node';}  // 回傳元件的標籤
    get scene() {return this._root.scene;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _addName()
    {
        const {scene,bb}=this.ctx;

        const x = 0;
        const y = -bb.hei/2+bb.zt;

        let lb = scene.add.text(
                x, y, bb.name,
                {   
                    fontFamily:'Arial',
                    fontSize:'24px',
                    color:'#000',
                    // stroke:'#fff',
                    // strokeThickness:3,
                    backgroundColor: '#ccc',
                    padding: {x:1,y:1}    
                })
                .setOrigin(0.5,1);

        this._p.add(lb).layout();
        this._name=lb;
    }

    _addTags()
    {
        const {scene}=this.ctx;
        this._tags = uPanel.call(this._p,scene,{orientation:'x'})
        this._p.layout();
    }

    _addPanel()
    {
        const {root,scene,bb}=this.ctx;
        const y=-bb.hei/2+bb.zt;
        this._p = uPanel.call(root,scene,{
                                        y:y,
                                        orientation:'y',
                                        rtl:true,
                                        bg:{color:GM.COLOR.WHITE,alpha:0}
                                    })
                        .setOrigin(0.5,1).layout();
    }

    // _addTag(q)
    // {
    //     const {scene}=this.ctx;
    //     this._tags.add(uTag(scene,{q:q}));
    //     this._p.layout();
    // }

    _addTag(q)
    {
        const {scene}=this.ctx;
        if(!this._tag) {this._tag=uTag.call(this._tags,scene);}
        this._tag.add(q);   
        this._p.layout();
    }

    _showName(on)
    {
        if(!on) {this._p.hide(this._name);}
        else {this._p.show(this._name);}
        this._p.layout();
    }

    _showTag(on)
    {
        if(!on) {this._p.hide(this._tags);}
        else {this._p.show(this._tags);}
        this._p.layout();
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        super.bind(root);

        const {bb}=this.ctx;
        //
        this._addPanel();
        this._addName();
        this._addTags();

        // 1.提供 [外部操作的指令]
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.addTag=this._addTag.bind(this);
        root.showName=this._showName.bind(this);
        root.showTag=this._showTag.bind(this);
        root.map=bb.map;

        // 3.註冊(event)給其他元件或外部呼叫
    }
}