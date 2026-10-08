import UiFrame from './uiframe.js'
import {GM,UI} from '../core/setting.js'
import {DEBUG,DBG} from '../core/debug.js'
import * as ui from './uicomponents.js'
import TimeSystem from '../systems/time.js'
import {T,dlog} from '../core/debug.js'
import Record from '../infra/record.js'
import UiPopup from './uipopup.js'
import Quality from '../systems/quality.js'
import {exec} from '../systems/script.js'
import Story from '../systems/story.js'
import Line from '../systems/line.js'


function cmd_get(args)
{
    // [get] [gold/item] [id] [count]
    const rewards=[{type:args[1],id:args[2],count:Number(args[3])}];
    GM.player.reward(rewards)
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
    if(args.length === 1)
    {
        let t = TimeSystem.time;
        let str = `d:${t.d} h:${t.h} m:${t.m}\n`;
        this.print(str)
    }
    else
    {
        for(let i=1;i<args.length;i++)
        {
            let [type,val]=args[i].split(':');
            dlog(T.UI)(type,val);
            TimeSystem.set(type,val)
        }
        TimeSystem.update();
        this.close();
    }
}

function cmd_q(args)
{
    // q                 列出所有存著的 quality
    // q <關鍵字>         列出名稱含關鍵字的 quality
    // q <name>=<v>      設值，也可以 q <name>+<n> / q <name>-<n>（名稱要寫完整，例如 karen.好感+10）
    const arg = args.slice(1).join('');
    const m = arg.match(/^(\S+?)(?:=\S*|[+-]\d+(?:\.\d+)?)$/);
    if(m)
    {
        exec([arg]);
        this.print(`✓ [color=cyan]${m[1]}[/color] = ${Quality.get(m[1])}\n`);
        return;
    }
    const rows = Object.entries(Quality.store).filter(([k])=>k.includes(arg));
    if(arg && rows.length===0) {rows.push([arg, `${Quality.get(arg)} (預設)`]);}
    if(rows.length===0) {this.print('(沒有 quality)\n'); return;}
    rows.forEach(([k,v])=>this.print(`[color=cyan]${k}[/color] = ${v}\n`));
}

function cmd_story(args)
{
    // story <npcId>     列出 who 對得上的對話卡與事件卡，標示成立與否
    if(!args[1]) {this.print('[color=yellow]用法: story <npcId>[/color]\n'); return;}
    this.print(Story.debug(args[1]));
    this.print(Line.debug(args[1]));
}

function cmd_pop(args)
{
    const msg = args.slice(1).join(' ') || '測試訊息';
    UiPopup.push(msg, {duration: 2000, animDuration: 300});
    this.print(`[color=blue]✓ 彈出訊息: ${msg}[/color]\n`);
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
            // width: GM.w/2,
            height : 400,
            orientation: 'y',
            // space: {left:10,right:10,bottom:10,item:0},
            space:UI.SPACE.FRAME,
            // cover: {interactive:true, alpha:0.5},
        }
        super(scene, config, UI.TAG.DEBUGER);
        UiDebuger.instance = this;
        this.addBg(scene,{color:GM.COLOR.PRIMARY,...UI.BG.BORDER_DARK})
            .addTop(scene, UI.TAG.DEBUGER)
            .addTabs(scene)
            // .addPage(scene)
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
                    top: [{text:'指令',name:'cmd'},{text:'設定',name:'setting'}],
                    onclick:(btn)=>{this._tab=btn.name;this.updatePage();},
                    createpanel:()=>{return this.createPage(scene);}
                })
        this._page =  this._tabs.getElement('panel');
        return this;
    }

    createPage(scene)
    {
        const config=
        {
            bg:{color:GM.COLOR.PRIMARY},
            width: GM.w/2,
            height: 310,
            space:{...UI.SPACE.LRTB.p10,item:10},
            ext:{expand:true},
        }
        return ui.uScroll(scene,config);
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
        dlog(T.UI)('cmd =',cmd)
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
                    background: ui.uRect(scene,{color:GM.COLOR.LIGHT}),
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
        
        const options_mode = Object.entries(DBG.MODE).map(([key, value]) => ({
            text: key,
            value: value
        }));

        const options_tag = Object.entries(T).map(([key, value]) => ({
            text: key,
            value: value
        }));

        const CHK=this.check.bind(this);
        const DD=this.dropdown.bind(this);
        const IN=this.textin.bind(this);


        this._page.clearAll();

        const refresh = ()=>{this.send('dbgRefresh')};
        this.addRow(CHK('除錯', DEBUG, 'enable', refresh),
                    DD('模式', DEBUG, 'mode', options_mode,{multi:true}))
            .addElm(CHK('座標', DEBUG, 'loc', refresh))
            .addElm(CHK('邊框', DEBUG, 'rect', refresh))
            .addElm(CHK('路徑', DEBUG, 'path', refresh))
            // .addRow(CHK('log', DEBUG, 'log'), IN(this.setFilter.bind(this)))
            .addRow(CHK('log', DEBUG, 'log'), 
                    DD('標籤', DEBUG, 'tag', options_tag,{multi:true}),
                    IN(DEBUG,'filter')
                )
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

    check(name, obj, key, cb)
    {
        return ui.uButton(this.scene, 
                {text:name,style:UI.BTN.CHECK,
                onclick:()=>{ obj[key] = !obj[key]; cb?.(obj[key])}})
                .setValue(obj[key]);
    }

    dropdown(name, obj, key, options, ext)
    {
        const p = ui.uPanel(this.scene,{space:{item:10}});
        ui.uBbc.call(p,this.scene, {text:name});
        ui.uDropdown.call(p,this.scene, 
                    {...ext,
                    options:options,
                    onchange:(v)=>{ obj[key]=v; this.layout();}})
                    .setValue(obj[key]);
        return p;
    }

    textin(obj, key)
    {
        const config =
        {
            width: 200,
            height: 36,
            onenter: (value)=>{obj[key]=value;},
            btn:false,
        }

        const input=ui.uInput(this.scene, config);
        input.setValue(obj[key]);
        return input;
    }
    
    ///////////////////////////////////////////////////

    // cmd：打開後切到指令頁直接執行（右鍵選單的劇情除錯用）
    show(cmd)
    {
        super.show();
        if(cmd) {this._tabs.init('top'); this.process(cmd);}
        else if(!this._tab) {this._tabs.init('top');}
        this.layout();
    }

    close()
    {
        super.close();
        Record.saveDebug();
    }

    static show(cmd) {UiDebuger.instance?.show(cmd);}
}