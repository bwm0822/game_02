import * as ui from './uicomponents.js'
import Ui from './uicommon.js'
import {GM} from '../setting.js'
import UiFrame from './uiframe.js'
import UiQuest from '../ui/uiquest.js'
import {UiInv, UiProfile, UiAbility, UiDebuger, AbilitySlot} from '../ui.js'
import {getPlayer} from '../roles/player.js'

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

        super(scene, config, 'UiMain');
        UiMain.instance = this;

        // 1. add bg
        this.addBg(scene);

        // 2. add buttons
        this.add(ui.uButton(scene,{text:'🎒',bg:{},onclick:this._inv}),{align:'bottom'})
            .add(ui.uButton(scene,{text:'👤',bg:{},onclick:this._profile}),{align:'bottom'})
            .add(ui.uButton(scene,{text:'📖',bg:{},onclick:this._quest}),{align:'bottom'})
            .add(ui.uButton(scene,{text:'🧠',bg:{},onclick:this._ability}),{align:'bottom'})
            .addCtrl(scene)
            .add(ui.uButton(scene,{text:'⏳',bg:{},onclick:this._next}),{align:'bottom'})
            .add(ui.uButton(scene,{text:'⚙️',bg:{},onclick:this._menu.bind(this)}),{align:'bottom'})
            .add(ui.uButton(scene,{text:'🐛',bg:{},onclick:this._debug}),{align:'bottom'})
            // .add(ui.uButton(scene,{text:'▶️',bg:{},onclick:this._profile}),{align:'bottom'})
        
        this.addEnableCtrl(scene)


        //
        this.setOrigin(0.5,1)
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
        this._hp = ui.uTextProgress.call(st,scene,{width:200});

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
    _inv() {UiInv.toggle(getPlayer());}     
    _profile() {UiProfile.toggle(getPlayer());}
    _quest() {UiQuest.toggle(getPlayer());}
    _ability() {UiAbility.toggle();}
    _next() {getPlayer().next();}
    _step() {getPlayer().dbgStep();}
    _debug() {UiDebuger.show();}
    // function有用到 this 參數，需要 bind(this)
    _menu() {this.close(); this.send('menu');} 


    refresh()
    {
        console.log('------------------ refresh')
        let total = getPlayer().total;
        this._hp.set(total.states[GM.HP],total[GM.HPMAX]);
        this.resetAbility();
        this.updateAbility();
    }

    colse()
    {
        super.close();
        this.unregister();   
    }

    show(owner)
    {
        super.show();
        this._owner=owner;
        this.register(GM.UI_BOTTOM);
    }

    static show(owner) {this.instance?.show(owner);}
    static enable(en) {this.instance?._enable(en);} 
}

