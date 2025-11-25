import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM, UI_STYLE} from '../setting.js'
import {Pic} from '../uibase.js'

export default class UiProfile extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : 0,
            y : 0,
            width : 400,
            height : 0,
            orientation : 'y',
            space:{left:10,right:10,bottom:10,item:5},
        }

        super(scene, config, 'UiProfile');
        UiProfile.instance=this;

        // layout
        this.addBg(scene)
            .addTop(scene,'profile')
            .addInfo(scene)
            .addTabs(scene)
            .addPage(scene)
            .setOrigin(0)
            .layout()
            .hide()
    }

    addInfo(scene)
    {
        const space = {left:5,right:5,top:5,bottom:5,item:5}
        const p = ui.uPanel.call(this, scene, {bg:UI_STYLE.BORDER, height:100, ext:{expand:true}} )

        // 左半部
        const pL = ui.uPanel.call(p, scene, {bg:UI_STYLE.BORDER, space:space, ext:{expand:true,proportion:1}} );
        // icon
        this._icon = new Pic( scene, GM.PORTRAITS_W, GM.PORTRAITS_H, {icon:'portraits/0'})
        pL.add( this._icon, {align:'top'} )
        // name / race
        this._name = ui.uBbc.call(pL, scene, {text:'阿凡達\n精靈', ext:{align:'top'}} )
        
        // 右半部
        // base stats
        const pR = ui.uPanel.call(p, scene, {bg:{...UI_STYLE.BORDER}, orientation:'y', space:space, ext:{expand:true, proportion:1}} )
        // ui.uProp.call(pR, scene, 'key', 123)
        // ui.uProp.call(pR, scene, 'key', 123)
        
        this._pR = pR;
        return this;
    }

    addTabs(scene)
    {
        this._tabs = ui.uTabs.call(this, scene, {
                    btns: [{text:'🎴',name:'stats'},{text:'❤️',name:'states'}],
                    onclick:(btn)=>{this._tab=btn.name;this.updatePage();}
                })
        
        return this;
    }

    addPage(scene)
    {
        const config=
        {
            bg:{},
            height:300,
            ext:{expand:true}
        }
        this._p = ui.uScroll.call(this,scene,config)

        return this;
    }

    updateInfo()
    {
        const scene=this.scene;

        // Icon
        let [key,frame]=this.owner.meta.icon.split('/');
        this._icon.setIcon(this.owner.meta.icon);

        // 姓名 / 種族
        this._name.setText(`${this.owner.id.lab()}\n${this.owner.meta.job?.lab()}`);

        // 基礎屬性
        this._pR.removeAll(true);
        for(const key of GM.BASE)
        {
            ui.uProp.call(this._pR,scene,key.lab(),this.total[key],true);   
        }

        return this;
    }

    updatePage()
    {
        const scene = this.scene;
        const addItem = (key,val)=>{this._p.addItem(ui.uProp(scene,key.lab(),val,true))}
        const addSeg = (seg)=>{this._p.addItem( ui.uBbc(scene,{text:`[color=yellow]${seg.lab()}[/color]`}), {} );}

        this._p.clearAll();

        switch(this._tab)
        {
            case 'states': 
                for(const key of GM.SURVIVAL)
                {
                    let max = this.total[key+'Max'];
                    let val= this.total.states[key];
                    let value = max ? `${val}/${max}` : `${Math.floor(val)}%`;

                    addItem(key,value)
                }
                break;

            case 'stats': 
                addSeg('combat');
                for(const key of GM.COMBAT)
                {
                    let value = this.total[key];
                    addItem(key,value)
                }
                addSeg('resist');
                for(const key of GM.RESIST)
                {
                    let value = this.total.resists[key];
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
        this.register(GM.UI_LEFT_P);
    }

     close()
    {
        if(!this.visible) {return;}

        super.close();
        this.unregister();
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



