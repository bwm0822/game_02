import UiFrame from './uiframe.js'
import {GM,UI,DEBUG,DBG} from '../setting.js'
import * as ui from './uicomponents.js'
import {getPlayer} from '../roles/player.js'
import TimeManager from '../time.js'


const E={CHK:'check',DD:'dropdown'};

function cmd_get(args)
{
    // [get] [gold/item] [id] [count]
    let rewards=[{type:args[1],id:args[2],count:args[3]}]
    getPlayer().receive(rewards)
}

function cmd_w(args)
{
    if(args.length < 4)
    {
        this.print('[color=yellow][參數太少][/color]\n')
    }
    else
    {
        let p={x:Number(args[1]),y:Number(args[2])}
        let weight=Number(args[3])
        send('setWeight',p,weight)
    }
}

function cmd_t(args)
{
    //console.log(args);
    if(args.length == 1)
    {
        let t = TimeManager.time;
        let str = `d:${t.d} h:${t.h} m:${t.m}\n`;
        this.print(str)
    }
    else
    {
        for(let i=1;i<args.length;i++)
        {
            let [type,val]=args[i].split(':');
            console.log(type,val);
            TimeManager.set(type,val)
        }
        TimeManager.update();
        this.close();
    }
}


export default class UiDebuger extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        const config=
        {
            x: GM.w/2,
            y: GM.h/2,
            width: GM.w/2,
            height : 200,
            orientation: 'y',

            space: {item:0},
            // cover: {interactive:true, alpha:0.5},
        }
        super(scene, config, UI.TAG.DEBUGER);
        UiDebuger.instance = this;
        this.addBg(scene,{color:GM.COLOR.PRIMARY,...UI.BG.BORDER_DARK})
            .addTop(scene, UI.TAG.DEBUGER)
            .addTabs(scene)
            .addPage(scene)
            .layout()
            .hide()

        // this.unit_test();

    }

    unit_test()
    {
        this.show();
    }

    addTabs(scene)
    {
        this._tabs = ui.uTabs.call(this, scene, {
                    btns: [{text:'指令',name:'cmd'},{text:'設定',name:'setting'}],
                    onclick:(btn)=>{this._tab=btn.name;this.updatePage();}
                })
        
        return this;
    }

    addPage(scene)
    {
        const config=
        {
            bg:{},
            height: 300,
            space:{...UI.SPACE.LRTB_10,item:10},
            ext:{expand:true},
            hideUnscrollableSlider:true,
        }
        this._page = ui.uScroll.call(this,scene,config)

        return this;
    }

    updatePage()
    {
        
        if(this._tab==='cmd') {this.page_Cmd();}
        else if(this._tab==='setting') {this.page_Setting();}

        this.layout();
    }

    ///////////////////////////////////////////////////
    // Cmd Page
    ///////////////////////////////////////////////////
    page_Cmd()
    {
        const scene = this.scene;
        this._page.clearAll();
        this._area = this.createArea(scene);
        this._input = this.addInput(scene);
        this._page.addItem(this._area)
                    .addItem(this._input)
    }

    print(str)
    {
        this._area.appendText(str);
        this._area.scrollToBottom();
    }

    process(cmd)
    {
        console.log('cmd =',cmd)
        const args = cmd.split(' ');
        try
        {
            const func = eval(`cmd_${args[0]}`);
            func.bind(this)(args);
        }
        catch(e)
        {
            this.print(cmd+'  [color=yellow][無效指令!!!][/color]\n')
        }
        // if(func) {func.bind(this)(args);}
        // else {this.print(cmd+'  [color=yellow][無效指令!!!][/color]\n')}
    }

    createArea(scene)
    {
        return scene.rexUI.add.textArea({
                    width: GM.w/2-50,
                    height: 230,
                    background: ui.uRect(scene,{color:GM.COLOR_LIGHT}),
                    text: ui.uBbc(scene),
                    //content: '123\n456\n789\n1111\n777\n888\n999\n111'
                })
    }

    addInput(scene)
    {
        const config =
        {
            width: GM.w/2-150,
            height: 36,
            onclick: this.process.bind(this)
        }
        const input=ui.uInput(scene, config);
        return input;
    }

    ///////////////////////////////////////////////////
    // Setting Page
    ///////////////////////////////////////////////////
    page_Setting()
    {
        const options_mode=
        [
            {text:'實體', value:DBG.MODE.BODY},
            {text:'格線', value:DBG.MODE.GRID},
            {text:'區域', value:DBG.MODE.ZONE},
            {text:'全部', value:DBG.MODE.ALL},
        ]

        const elm=this.element.bind(this);

        this._page.clearAll();

        this.addRow(elm(E.CHK,'除錯', DEBUG, 'enable'),
                    elm(E.DD,'模式', DEBUG, 'mode', options_mode))
            .addElm(elm(E.CHK,'座標', DEBUG, 'loc'))
    }

    addRow(...options)
    {
        const p = ui.uPanel(this.scene,{space:{item:10}});
        options.forEach((opt)=>{p.add(opt);});
        this._page.addItem(p);
        return this;
    }

    addElm(elm)
    {
        this._page.addItem(elm);
        return this;
    }

    element(type, name, obj, key, options)
    {
        if(type===E.CHK) {return this.check(name, obj, key);}
        else if(type===E.DD) {return this.dropdown(name, obj, key, options);}
    }

    check(name, obj, key)
    {
        return ui.uButton(this.scene, 
                {text:name,style:UI.BTN.CHECK,
                onclick:()=>{ obj[key] = !obj[key]; }})
                .setValue(obj[key]);
    }

    dropdown(name, obj, key, options)
    {
        const p = ui.uPanel(this.scene,{space:{item:10}});
        ui.uBbc.call(p,this.scene, {text:name});
        ui.uDropdown.call(p,this.scene, 
                    {options:options,
                    onchange:(v)=>{ obj[key]=v; }})
                    .setValue(obj[key]);
        return p;
    }
    
    ///////////////////////////////////////////////////

    show()
    {
        super.show();
        !this._tab&&this._tabs.init();
        this.layout();
    }

    static show() {UiDebuger.instance?.show();}
}