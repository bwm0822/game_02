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
import DB from '../data/db.js'


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
        this.send('setWeight',p,weight)
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
    // q <name>=<v>      設值，也可以 q <name>+<n> / q <name>-<n>（名稱要寫完整，例如 karen.favor+10）
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

///////////////////////////////////////////////////
// 指令頁的下拉表單：fields 依序產生欄位（dd=下拉選項、否則是輸入框），build 組回指令字串交給 process()
//  - if：欄位顯示條件；fresh：每次重建都重算預設值（目前時間、玩家位置）
//  - parse：右鍵選單直接丟指令字串進來時，反解析回表單值
///////////////////////////////////////////////////
const CAT_NAME = Object.fromEntries(Object.entries(GM.CAT).map(([k,v])=>[v,k]));

const opts = (arr)=>arr.map((o)=>typeof o==='object'?o:{text:String(o),value:o});

const npcOpts = ()=>DB.roleIds().filter((id)=>DB.role(id).kind==='npc').map((id)=>({text:id,value:id}));

const catOpts = ()=>{
    const cats = [...new Set(DB.itemIds().map((id)=>DB.item(id).cat))];
    return [{text:'全部',value:'all'},
            ...cats.filter((c)=>c!==undefined).map((c)=>({text:CAT_NAME[c],value:c})),
            ...(cats.includes(undefined)?[{text:'其他',value:'other'}]:[])];
}

const itemOpts = (cat)=>DB.itemIds()
    .filter((id)=>{
        const c = DB.item(id).cat;
        return cat==='all' || (cat==='other'?c===undefined:c===cat);
    })
    .map((id)=>({text:DB.item(id).lab??id,value:id}));

const qOpts = ()=>[{text:'(全部)',value:''},
                    ...Object.keys(DB.qualities()).filter((k)=>!k.includes('*')).map((k)=>({text:k,value:k}))];

const isNpcQ = (name)=>Quality.decl(name)?.scope==='npc';

const CMDS =
{
    raw:    {text:'手打', usage:'輸入完整指令',
            fields:[{key:'line', get w() {return GM.w/2-150;}}],
            build:(v)=>v.line},

    get:    {usage:'取得金錢／道具',
            fields:[{key:'type', dd:()=>opts(['item','gold']), w:80},
                    {key:'cat', dd:catOpts, w:130, if:(v)=>v.type==='item'},
                    {key:'id', dd:(v)=>itemOpts(v.cat), w:160, if:(v)=>v.type==='item'},
                    {key:'count', lab:'數量', def:'1'}],
            build:(v)=>`get ${v.type} ${v.type==='item'?v.id:'-'} ${v.count}`},

    w:      {usage:'設定格子權重（世界座標）',
            fields:[{key:'x', lab:'x', fresh:true, def:()=>String(Math.round(GM.player?.x??0))},
                    {key:'y', lab:'y', fresh:true, def:()=>String(Math.round(GM.player?.y??0))},
                    {key:'weight', lab:'weight', def:'0'}],
            build:(v)=>`w ${v.x} ${v.y} ${v.weight}`},

    t:      {usage:'查詢／設定時間',
            fields:[{key:'mode', dd:()=>opts([{text:'查詢',value:'?'},{text:'設定',value:'set'}]), w:80},
                    {key:'d', lab:'天', fresh:true, def:()=>String(TimeSystem.time.d), if:(v)=>v.mode==='set'},
                    {key:'h', lab:'時', fresh:true, def:()=>String(TimeSystem.time.h), if:(v)=>v.mode==='set'},
                    {key:'m', lab:'分', fresh:true, def:()=>String(TimeSystem.time.m), if:(v)=>v.mode==='set'}],
            build:(v)=>v.mode==='set'?`t d:${v.d} h:${v.h} m:${v.m}`:'t'},

    q:      {usage:'查詢／設定 quality',
            fields:[{key:'name', dd:qOpts, w:180},
                    {key:'npc', dd:npcOpts, w:100, if:(v)=>isNpcQ(v.name)},
                    {key:'op', dd:()=>opts([{text:'查詢',value:'?'},'=','+','-']), w:70, if:(v)=>v.name},
                    {key:'val', def:'10', if:(v)=>v.name&&v.op!=='?'}],
            build:(v)=>{
                if(!v.name) {return 'q';}
                const full = isNpcQ(v.name) ? `${v.npc}.${v.name}` : v.name;
                return v.op==='?' ? `q ${full}` : `q ${full}${v.op}${v.val}`;
            }},

    story:  {usage:'列出 NPC 的對話卡與事件卡',
            fields:[{key:'npc', dd:npcOpts, w:120}],
            build:(v)=>`story ${v.npc}`,
            parse:(args)=>({npc:args[1]})},

    pop:    {usage:'測試彈出訊息',
            fields:[{key:'msg', lab:'訊息', def:'測試訊息', w:250}],
            build:(v)=>`pop ${v.msg}`},
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
        this._cmd = Object.keys(CMDS)[0];
        this._vals = {};
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
        this._page.addItem(this._area)
                    .addItem(this.createCmdRow(scene));
        this._params = null;
        this.buildParams();
    }

    createCmdRow(scene)
    {
        const p = ui.uPanel(scene,{space:{item:10}});
        ui.uDropdown.call(p, scene, {
                    width: 100,
                    ext: {},
                    options: Object.entries(CMDS).map(([k,d])=>({text:d.text??k,value:k})),
                    onchange: (v)=>{
                        if(v===this._cmd) {return;}
                        this._cmd = v;
                        this.rebuild();
                    }})
                    .setValue(this._cmd);
        this._usage = ui.uBbc.call(p, scene, {text:'', ext:{proportion:1}});
        ui.uButton.call(p, scene, {text:'執行', onclick:()=>this.exec()});
        return p;
    }

    // 下拉的 onchange 是在選單按鈕的點擊事件裡呼叫，延到下一幀再重建，避免在事件中銷毀選單
    rebuild()
    {
        this.scene.time.delayedCall(0, ()=>{if(this._tab==='cmd') {this.buildParams();}});
    }

    buildParams()
    {
        const scene = this.scene;
        const def = CMDS[this._cmd];
        const v = this._vals[this._cmd] ??= {};
        def.fields.forEach((f)=>{
            if(f.fresh || !(f.key in v)) {v[f.key] = typeof f.def==='function' ? f.def() : (f.def ?? '');}
        });

        if(this._params) {this._page._panel.remove(this._params, true);}
        this._usage.setText(`[color=gray]${def.usage}[/color]`);
        this._inputs = {};
        this._params = ui.uPanel(scene,{space:{item:10}});
        def.fields.forEach((f)=>{
            if(f.if && !f.if(v)) {return;}
            if(f.lab) {ui.uBbc.call(this._params, scene, {text:f.lab});}
            if(f.dd) {this.addDD(f, v);}
            else
            {
                this._inputs[f.key] = ui.uInput.call(this._params, scene, {
                                width: f.w ?? 60,
                                height: 36,
                                btn: false,
                                onenter: (t)=>{v[f.key]=t;}});
                this._inputs[f.key].setValue(v[f.key]);
            }
        });
        this._page.addItem(this._params);
        this.layout();
    }

    addDD(f, v)
    {
        const options = f.dd(v);
        if(!options.some((o)=>o.value===v[f.key])) {v[f.key] = options[0].value;}
        ui.uDropdown.call(this._params, this.scene, {
                    width: f.w ?? 120,
                    ext: {},
                    options: options,
                    onchange: (val)=>{
                        if(val===v[f.key]) {return;}
                        v[f.key] = val;
                        this.rebuild();
                    }})
                    .setValue(v[f.key]);
    }

    exec()
    {
        const v = this._vals[this._cmd];
        Object.entries(this._inputs).forEach(([k,input])=>{v[k]=input.getValue();});
        const cmd = CMDS[this._cmd].build(v).trim();
        if(cmd) {this.process(cmd);}
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
        this.print(`[color=gray]> ${cmd}[/color]\n`);
        try
        {
            const func = eval(`cmd_${args[0]}`);
            func.bind(this)(args);
        }
        catch(e)
        {
            this.print('[color=yellow][無效指令!!!][/color]\n')
        }
        // if(func) {func.bind(this)(args);}
        // else {this.print(cmd+'  [color=yellow][無效指令!!!][/color]\n')}
    }

    createArea(scene)
    {
        return scene.rexUI.add.textArea({
                    width: GM.w/2-50,
                    height: 180,
                    background: ui.uRect(scene,{color:GM.COLOR.LIGHT}),
                    text: ui.uBbc(scene),
                    //content: '123\n456\n789\n1111\n777\n888\n999\n111'
                })
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
        if(cmd)
        {
            const args = cmd.split(' ');
            const parse = CMDS[args[0]]?.parse;
            if(parse) {this._cmd = args[0]; Object.assign(this._vals[args[0]] ??= {}, parse(args));}
            this._tabs.init('top');
            this.process(cmd);
        }
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