import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM, UI} from '../core/setting.js'
import {dlog} from '../core/debug.js'

export default class UiProfile extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : 0,
            y : 0,
            // width : 400,
            height : 0,
            orientation : 'y',
            space:UI.SPACE.FRAME,
        }

        super(scene, config, UI.TAG.PROFILE);
        UiProfile.instance=this;

        // layout
        this.addBg(scene)
            .addTop(scene, UI.TAG.PROFILE)
            .addInfo(scene)
            .addTabs(scene)
            .setOrigin(0)
            .layout()
            .hide()
    }

    addInfo(scene)
    {
        const space = UI.SPACE.LRTBI_5;
        const p = ui.uPanel.call(this, scene, {bg:UI.BG.BORDER, height:100, 
                                                ext:{expand:true}} )

        // 左半部 (人像、說明)
        const pL = ui.uPanel.call(p, scene, {bg:UI.BG.BORDER, space:space, 
                                                ext:{expand:true,proportion:1}} );
        const pic = ui.uPic.call(pL,scene,{w:GM.PORTRAITS.W,h:GM.PORTRAITS.H,
                                            bg:UI.BG.SLOT,ext:{align:'top'}});
        const bbc = ui.uBbc.call(pL, scene, {text:'阿凡達\n精靈', 
                                                ext:{align:'top'}} )
        
        // 右半部 (基礎屬性)
        const pR = ui.uPanel.call(p, scene, {bg:{...UI.BG.BORDER}, orientation:'y', space:space, 
                                                ext:{expand:true, proportion:1}} )

        // 操作介面
        p.setIcon = (owner)=>{pic.setIcon(owner.icon);}
        p.setDes = (owner)=>{bbc.setText(`${owner.id.lab()}\n${owner.job?.lab()}`);}
        p.clear = ()=>{pR.removeAll(true);}
        p.addItem = (key,val)=>{ui.uStat.call(pR,scene,key,val);}
        
        this._info=p;
        return this;
    }

    addTabs(scene)
    {
        this._tabs = ui.uTabs.call(this, scene, {
                    top: [{text:'🎴',name:'stats'},{text:'❤️',name:'states'}],
                    onclick:(btn)=>{this._tab=btn.name;this.updatePage()},
                    createpanel:()=>{return this.createPage(scene)},
                })

        this._page =  this._tabs.getElement('panel');        
        return this;
    }

    createPage(scene)
    {
        const config=
        {
            bg:{color:GM.COLOR.PRIMARY},
            width:400,
            height:300,
            // ext:{expand:true,proportion:1}
        }
        return ui.uScroll(scene,config);
    }

    updateInfo()
    {
        const scene = this.scene;

        // Icon
        this._info.setIcon(this.owner);

        // 姓名 / 種族
        this._info.setDes(this.owner)

        // 基礎屬性
        this._info.clear();
        for(const key of GM.BASE)
        {
            this._info.addItem(key.lab(),this.total[key])
        }

        return this;
    }

    updatePage()
    {
        const scene = this.scene;
        const addItem = (key,val)=>{this._page.addItem(ui.uStat(scene,key.lab(),val,true))}
        const addSeg = (seg)=>{this._page.addItem( ui.uBbc(scene,{text:`[color=yellow]${seg.lab()}[/color]`}), {} );}

        this._page.clearAll();

        switch(this._tab)
        {
            case 'states': 
                const survival=this.owner.bb.meta.survival;
                const keys = survival?[GM.HP,...GM.SURVIVAL]:[GM.HP]
                for(const key of keys)
                {
                    const max = this.total[key+'Max'];
                    const val= this.total.states[key];
                    const value = max ? `${val}/${max}` : `${Math.floor(val)}%`;
                    addItem(key,value)
                }
                break;

            case 'stats': 
                addSeg('combat');
                for(const key of GM.COMBAT)
                {
                    const value = this.total[key];
                    addItem(key,value)
                }
                addSeg('resist');
                for(const key of GM.RESIST)
                {
                    const value = this.total.resists[key];
                    addItem(key,value)
                }
                break;
        }

        this.layout();

        return this;
    }

    refresh() // call by Ui.refreshAll()
    {
        if(this.visible)
        {
            this.total = this.owner.total;
            this.updateInfo()
                .updatePage()
                .layout();
        }
    }  

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.total = this.owner.total;
        this.updateInfo()
        this._tabs.init();
        this._page.mouseWheel(true);
        this._page.setT(0);
        //
        this.closeAll(GM.UI_LEFT_P);
        this.register(GM.UI_LEFT_P);
        this.setCamera(GM.CAM_RIGHT);
    }


    close()
    {
        if(!this.visible) {return;}

        super.close();
        this._page.mouseWheel(false);

        this.unregister();
        this.clrCamera(GM.CAM_RIGHT);
    }
    
    toggle(owner)
    {
        if(this.visible){this.close();}
        else{this.show(owner)}
    }

    static show(owner) {this.instance?.show(owner);}
    static close() {this.instance?.close();}
    // static refresh() {UiProfile.instance?.update();}
    static toggle(owner) {this.instance?.toggle(owner);}
    static get shown() {this.instance?.visible;}
    

}



