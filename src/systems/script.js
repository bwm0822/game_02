import Quality from './quality.js'
import QuestManager from '../manager/quest.js'
import {GM} from '../core/setting.js'

//--------------------------------------------------
// 條件 / 指令共用模組，語法見 docs/story-architecture.md §3、§4
//  ctx = {npc, facts, cb}
//   npc   : 當下 NPC 的 id，_xxx 與 scope=npc 的名稱會補上這個前綴
//   facts : 情境事實（time/map/hp…），由呼叫方提供
//   cb    : 認不得的指令(close/goto/trade…)交給呼叫方處理，cb(op, args)
//--------------------------------------------------

// 跟 scripts/story.js 的 actionNames() 同一套規則
const COND_PREFIX = /^(.*?)\s+:\s+(.*)$/;
const ASSIGN = /^(\S+?)(?:=(\S*)|([+-])(\d+(?:\.\d+)?))$/;
const COMPARE = /^(.+?)\s*(>=|<=|!=|==|=|>|<)\s*(.+)$/;

function _num(v)
{
    if(v === true) {return 1;}
    if(v === false || v === undefined || v === null) {return 0;}
    return v;
}

function _literal(s)
{
    if(s === 'true') {return 1;}
    if(s === 'false') {return 0;}
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s;
}

function _truthy(v) {v = _num(v); return v !== 0 && v !== '';}

function _countItem(id)
{
    return GM.player.queryItem(itm=>itm.id===id).reduce((s,itm)=>s+itm.count, 0);
}

function _value(name, ctx)
{
    if(name.startsWith('#')) {return QuestManager.getState(name.slice(1));}
    if(name.startsWith('item:'))
    {
        const [, id, count] = name.split(':');
        return _countItem(id) >= Number(count ?? 1) ? 1 : 0;
    }
    if(name === 'gold') {return GM.player.gold;}
    if(ctx.facts && name in ctx.facts) {return ctx.facts[name];}
    return Quality.get(Quality.resolve(name, ctx.npc));
}

function _compare(a, op, b)
{
    a = _num(a);
    const numeric = typeof a === 'number' && typeof b === 'number';
    switch(op)
    {
        case '==': case '=':   return a == b;
        case '!=':  return a != b;
        case '>=':  return numeric && a >= b;
        case '<=':  return numeric && a <= b;
        case '>':   return numeric && a > b;
        case '<':   return numeric && a < b;
    }
    return false;
}

export function evalCond(expr, ctx={})
{
    if(expr === undefined || expr === null || expr === '' || expr === true) {return true;}
    expr = String(expr).trim();
    if(expr === 'true') {return true;}
    if(expr === 'false') {return false;}

    if(expr.includes('||')) {return expr.split('||').some(e=>evalCond(e, ctx));}
    if(expr.includes('&&')) {return expr.split('&&').every(e=>evalCond(e, ctx));}

    if(expr.startsWith('!')) {return !_truthy(_value(expr.slice(1).trim(), ctx));}

    const m = expr.match(COMPARE);
    if(m) {return _compare(_value(m[1].trim(), ctx), m[2], _literal(m[3].trim()));}

    return _truthy(_value(expr, ctx));
}

function _set(name, v, ctx) {Quality.set(Quality.resolve(name, ctx.npc), v);}

function _run(cmd, ctx)
{
    const m = cmd.match(ASSIGN);
    if(m)
    {
        const [, name, val, sign, n] = m;
        if(name === 'gold') {GM.player.reward([{type:'gold', count:(sign==='-'?-1:1)*Number(n ?? val)}]); return;}
        if(sign) {Quality.add(Quality.resolve(name, ctx.npc), (sign==='-'?-1:1)*Number(n));}
        else {_set(name, _literal(val), ctx);}
        return;
    }

    const [op, ...args] = cmd.split(/\s+/);
    const [p1, p2] = args;
    switch(op)
    {
        case 'give':    GM.player.reward([{type:'item', id:p1, count:Number(p2 ?? 1)}]); break;
        case 'take':
        case 'consume': GM.player.consumeItem?.({id:p1, count:Number(p2 ?? 1)}); break;
        // 舊指令，任務/對話搬到 story.xlsx 後移除
        case 'set':     _set(p1, p2 === undefined ? 1 : _literal(p2), ctx); break;
        case 'clr':
        case 'rm':      _set(p1, Quality.default(Quality.resolve(p1, ctx.npc)), ctx); break;
        case 'qstart':  QuestManager.start(p1); break;
        case 'qclose':  QuestManager.close(p1); break;
        default:        ctx.cb?.(op, args); break;
    }
}

export function exec(actions, ctx={})
{
    if(!actions?.length) {return;}
    for(const action of actions)
    {
        const m = action.match(COND_PREFIX);
        if(m && !evalCond(m[1], ctx)) {continue;}
        _run((m ? m[2] : action).trim(), ctx);
    }
}
