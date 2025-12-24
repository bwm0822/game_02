import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../setting.js'
import {AbilitySlot} from '../ui.js'
import UiInv from '../ui/uiinv.js'
import UiQuest from '../ui/uiquest.js'
import UiProfile from '../ui/uiprofile.js'
import UiAbility from '../ui/uiability.js'
import UiDebuger from '../ui/uidebuger.js'

export default class UiMain extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config = {
            x: GM.w/2,
            y: GM.h,
            width: 400,
            height: 60,
            orientation:'x',
            space:{left:5,right:5,top:5,bottom:5,item:5}
        }

        super(scene, config, UI.TAG.MAIN);
        UiMain.instance = this;

        // layout
        this.addBg(scene)
            .add(ui.uButton(scene,{text:'🎒',onclick:this._inv.bind(this)}),{align:'bottom'})
            .add(ui.uButton(scene,{text:'👤',onclick:this._profile.bind(this)}),{align:'bottom'})
            .add(ui.uButton(scene,{text:'📖',onclick:this._quest.bind(this)}),{align:'bottom'})
            .add(ui.uButton(scene,{text:'🧠',onclick:this._ability.bind(this)}),{align:'bottom'})
            .addCtrl(scene)
            .add(ui.uButton(scene,{text:'⏳',onclick:this._next.bind(this)}),{align:'bottom'})
            .add(ui.uButton(scene,{text:'⚙️',onclick:this._menu.bind(this)}),{align:'bottom'})
            .add(ui.uButton(scene,{text:'🐛',onclick:this._debug}),{align:'bottom'})
            // .add(ui.uButton(scene,{text:'▶️',onclick:this._profile}),{align:'bottom'})
            .addEnableCtrl(scene)
            .setOrigin(0.5,1)
            .layout()
            .hide()
    }

    addCtrl(scene)
    {
        let config = {
            width: 200,
            height: 60,
            orientation:'y',
            space:{item:5}
        }

        this.resetAbility = () => {
            ab.children.forEach((slot) => {
                if(slot instanceof AbilitySlot) {slot.reset();}
            });
        }

        this.updateAbility = () => {
            ab.children.forEach((slot) => {
                if(slot instanceof AbilitySlot) {slot.update();}
            });
        }

        const p = ui.uPanel.call(this,scene, config);
        
        // state
        const st = ui.uPanel.call(p, scene, {ext:{expand:true}});
        this._hp = ui.uProgress.call(st,scene,{width:200,style:UI.PROGRESS.VAL});

        // ability
        const ab = ui.uPanel.call(p, scene, {space:{item:5},ext:{expand:true}});
        for(let i=0;i<10;i++)
        {
            // ui.uRect.call(ab,scene,{width:50,height:50,color:GM.COLOR_GRAY})
            ab.add(new AbilitySlot(scene,50,50,i,{color:GM.COLOR_SLOT}))
        }

        return this;
    }

    addEnableCtrl(scene)
    {
        // this.addBackground(rect(scene,{alpha:0}),'enable');
        this._enCtrl = ui.uBg.call(this, scene, {alpha:0})
        return this;
    }

    _enable(en)
    {
        if(en){this._enCtrl.disableInteractive();}
        else{this._enCtrl.setInteractive();}
    }

    // 功能鍵
    // function內沒有用到 this 參數，就不需要 bind(this)
    _debug() {UiDebuger.show();}
    // function有用到 this 參數，需要 bind(this)
    _inv() {UiInv.toggle(this.player);}     
    _profile() {UiProfile.toggle(this.player);}
    _quest() {UiQuest.toggle(this.player);}
    _ability() {UiAbility.toggle();}
    _next() {this.player.next();}
    _step() {this.player.dbgStep();}
    _menu() {this.close(); this.send('menu');} 


    refresh()
    {
        let total = this.player.total;
        this._hp.setValue(total.states[GM.HP],total[GM.HPMAX]);
        this.resetAbility();
        this.updateAbility();
    }

    colse()
    {
        super.close();
        this.unregister();   
    }

    show()
    {
        super.show();
        this.register(GM.UI_BOTTOM);
    }

    static show() {this.instance?.show();}
    static enable(en) {this.instance?._enable(en);} 
}

