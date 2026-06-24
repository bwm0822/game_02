import Com from './com.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import QuestManager from '../manager/quest.js'
import {dlog} from '../core/debug.js'
import Record from '../infra/record.js'
const _tag = 'talk';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : talk
// 功能 : 
//  交談
//--------------------------------------------------

function parseOption(str, rec) 
{
    // options 的格式 : "(cond)text/cmds"
    const opt = extractOption(str);
    opt.cond = opt.cond ? checkCond(opt.cond, rec) : true;
    opt.cmds = opt.cmds ? opt.cmds.split(';').map(s => s.trim()) : [];
    return opt;
}


function extractOption(str) 
{
    // 1. 嘗試有 (cond) 的格式 : (cond)text/cmds
    let m = str.match(/^\((.*?)\)([^\/]*)(?:\/(.*))?$/);
    if (m) {return {cond: m[1],text:m[2],cmds:m[3]};}

    // 2. 沒有 (cond) 的格式： text/cmds
    m = str.match(/^([^\/]*)(?:\/(.*))?$/);
    if (m) {return {cond: null,text: m[1],cmds: m[2]};}

    return {cond: null,text: str,cmds: null};
}

function extractCond(str) 
{
    str = str.trim();

    // 1. A op B 形式
    let m = str.match(/^(\S+)\s*(!=|==|>=|<=|>|<)\s*(\S+)$/);
    if (m) {return { A: m[1], op: m[2], B: m[3] };}

    // 2. op A 形式
    m = str.match(/^(!)\s*(\S+)$/);
    if (m) {return { A: m[2], op: m[1], B: null };}

    return null; // 不符合格式
}

function checkCond(cond, rec)
{
    const c = extractCond(cond);
    if(!c) {return true;}  // 無條件

    const valA = parseP(c.A, rec);
    const valB = parseP(c.B, rec);
    // const valB = c.B !== null ? (isNaN(c.B) ? rec[c.B] : Number(c.B)) : null;
    switch(c.op)
    {
        case '==': return valA == valB;
        case '!=': return valA != valB;
        case '>=': return valA >= valB;
        case '<=': return valA <= valB;
        case '>':  return valA > valB;
        case '<':  return valA < valB;
        case '!':  return !valA;
        default:   return false;
    }
}

function parseP(str, rec)
{
    // 格式 : 'val#key:def'
    // 1. str='val' 回傳 val
    // 2. str='#key' 回傳 rec[key]
    // 3. str='#key:def' 回傳 rec[key]，若無則回傳 def
    
    if(!str) {return null;}
    const [val, key, def] = str.split(/[#:]/);
    return val!=''?val:rec[key]??def;
}

export class COM_Talk extends Com
{
    constructor()
    {
        super();
        this._rec={};
    }

    get tag() {return _tag;}  // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _execute(cmds, cb)
    {
        cmds?.forEach(cmd=>{
            const [op,p1,p2]=cmd.split(' ');
            switch(op)
            {
                case 'next': 
                case 'exit': cb?.(op); break;
                case 'trade': this._trade(); cb?.('exit'); break;
                case 'goto': this._goto(p1); cb?.(op); break;
                // case 'quest': this._quest(p1); cb?.('exit'); break;
                case 'quest': this._quest(p1); break;
                case 'close': this._close_quest(p1); break;
                case 'set': this._set(p1,p2); break;
                case 'sete': Record.setEntry(p1,p2); break;
                case 'add': Record.addOpt(p1,p2); break;
                case 'rm': Record.rmOpt(p1,p2); break;
            }
        })
    }

    _processOptions(options)
    {
        // options的格式 : "(cond)text/cmd0;cmd1"

        let opts=[];
        options.forEach(option=>{
            if(option==='[opt]')
            {
                Record.getVar(this.ctx.bb.id)?.opts?.forEach(id=>{
                    const dialog = this._dialog[id];
                    if(dialog) 
                    {
                        const opt = parseOption(dialog.opt);
                        if(opt.cond) {opts.push(opt);}
                    }
                });
            }
            else
            {
                const opt = parseOption(option, this._rec);
                if(opt.cond) {opts.push(opt);}
            }
        });

        return opts;
    }

    _addOptions(opts)
    {
        Record.getVar(this.ctx.bb.id)?.opt?.forEach(id=>{
            const dialog = this._dialog[id];
            if(dialog) 
            {
                const opt = parseOption(dialog.opt);
                if(opt.cond) {opts.push(opt);}
            }
        });
    }

    _goto(p1) 
    {
        this._idx = parseP(p1,this._rec);
        console.log('idx=',this._idx)
    }

    _trade()
    {
        const {emit}=this.ctx;
        emit('trade', GM.player)  // trade.js
    }

    _quest(p1)
    {
        QuestManager.add(p1);
        this._set('quest', p1);
    }

    _close_quest(p1)
    {
        const {send}=this.ctx;
        
        send('msg', '任務完成！');
        QuestManager.close(p1);
    }

    _set(key, value)
    {
        this._rec[key]=value;
    }

    _actMode()
    {
        const {bb,fav} = this.ctx;

        if(!this._dialog) {return GM.HIDE;}

        return fav()<=GM.FAV.DISLIKE ? GM.HIDE  
                                    :  bb.sta===GM.ST.SLEEP ? GM.DIS
                                                            : GM.EN;
    }

    _talk()
    {
        const{send,root} = this.ctx;
        this._idx = Record.getVar(root.id).entry??0;
        send('talk', root); // 開啟 對話UI
    }

    _select(option, cb)
    {
        this._execute(option.cmds, cb);
    }

    _getDialog()
    {
        const{bb} = this.ctx;
        const dat = Record.getVar(bb.id);

        const idx = this._idx;
        let dialog = this._dialog[idx];
        console.log(idx, dialog)

        if(dialog.type==='quest')
        {
            const sta = QuestManager.query(idx);
            dialog = dialog[sta?.state??'start'];
        }

        this._execute(dialog.cmds);
        const a = dialog.A;
        const b = this._processOptions(dialog.B);
        const out = {A:a, B:b};
        return out;
    }

    _ondead() {this.root._delAct(GM.TALK);}

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        super.bind(root);

        // init
        const {bb} = this.ctx;
        this._dialog = DB.dialog(bb.id);

        // 1.提供 [外部操作的指令]
        root._setAct(GM.TALK, this._actMode.bind(this));

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.talk = this._talk.bind(this);
        root.select = this._select.bind(this);
        root.getDialog = this._getDialog.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.TALK, this._talk.bind(this));
        root.on(GM.EVT.ONDEAD, this._ondead.bind(this));
    }

    load(data)
    {
        if(data?.[_tag]) {Object.assign(this._rec, data[_tag]);}
    }

    save() {return {[_tag]:this._rec};}
}