import DB from '../data/db.js'
import Record from '../infra/record.js'
import Quality from './quality.js'
import TimeSystem from './time.js'
import {exec, evalCond, valueOf} from './script.js'
import Ui from '../ui/uicommon.js'
import {UI} from '../core/setting.js'
import {T,dlog} from '../core/debug.js'

//--------------------------------------------------
// storylet 與任務日誌，設計見 docs/story-architecture.md §5、§7、§9
//  - 對話卡（有 who、沒有 on）：COM_Talk 跟 NPC 對話時用 talkCards() 取得選項
//  - 事件卡（有 on）：fire(on, facts) 時檢查 requires、套用 effects
//  - 日誌：thread 的 quality 換到表上有的值時，記進 Record.game.journal[thread]
//--------------------------------------------------

function _popup(msg) {Ui.get(UI.TAG.POPUP)?.push(msg);}

// 日誌文字的 {quality名} 換成目前的值
function _fill(text) {return String(text ?? '').replace(/\{([^}]+)\}/g, (_, n)=>Quality.get(n));}

// 跟 GameScene 的 lutAmbient 暗下來的時段一致
function _timeFacts(h) {return {hour:h, time: h<6 || h>=18 ? 'night' : 'day'};}

// 所有查詢都附帶的情境事實（line 也用）
export function worldFacts() {return {map:Record.game.map, ..._timeFacts(TimeSystem.time.h)};}

export default class Story
{
    static updated = new Set();     // 日誌有新進度、還沒看過的 thread（紅點）
    static _fired = null;           // 這一輪已觸發過的事件卡，避免 quality 事件連鎖

    static { Quality.onChange(this._onQuality.bind(this)); }

    static get journal() {return Record.game.journal ??= {};}
    static get counters() {return Record.game.counters ??= {};}

    static get _storylets() {return DB.story()?.storylets ?? [];}
    static get _threads() {return DB.story()?.threads ?? {};}

    // who 對 npc 的具體程度：2 指名、1 job、0 萬用、-1 對不上
    static _rank(who, npc)
    {
        if(!who || !npc) {return -1;}
        if(who === npc) {return 2;}
        if(who.startsWith('job:')) {return DB.role(npc)?.job === who.slice(4) ? 1 : -1;}
        return who === '*' ? 0 : -1;
    }

    // 同一個 id 有多張卡時，只留最具體的那張
    static _forNpc(cards, npc)
    {
        const best = {};
        for(const s of cards)
        {
            const r = this._rank(s.who, npc);
            if(r >= 0 && !(best[s.id]?.r >= r)) {best[s.id] = {s, r};}
        }
        return Object.values(best).map(b=>b.s);
    }

    //------------------------------------------------------
    //  對話卡
    //------------------------------------------------------
    // 回傳 [{card, enabled}]，enabled=false 是 tease 中（灰色選項）
    static talkCards(npc)
    {
        const ctx = {npc, facts:worldFacts()};
        const out = [];
        for(const s of this._forNpc(this._storylets.filter(s=>!s.on), npc))
        {
            if(evalCond(s.requires, ctx)) {out.push({card:s, enabled:true});}
            else if(s.tease && evalCond(s.tease, ctx)) {out.push({card:s, enabled:false});}
        }
        return out;
    }

    static node(npc, id) {return DB.story()?.nodes?.[npc]?.[id];}

    //------------------------------------------------------
    //  事件卡
    //------------------------------------------------------
    static fire(on, facts={})
    {
        const outer = !this._fired;
        if(outer) {this._fired = new Set();}
        facts = {...worldFacts(), ...facts};
        try
        {
            for(const s of this._storylets)
            {
                if(!s.on?.includes(on) || this._fired.has(s)) {continue;}
                if(s.who && this._rank(s.who, facts.who) < 0) {continue;}
                const ctx = {npc:facts.who, facts};
                if(!evalCond(s.requires, ctx)) {continue;}
                this._fired.add(s);
                dlog(T.STORY)(`[S] ${on} → ${s.id}`);
                exec(s.effects, ctx);
                if(s.text) {_popup(s.text);}
            }
        }
        finally {if(outer) {this._fired = null;}}
    }

    static onKill(id)
    {
        Quality.add(`殺.${id}`, 1);
        for(const [name, src] of Object.entries(this.counters))
        {
            if(src === `kill:${id}`) {Quality.add(name, 1);}
        }
        this.fire('kill', {dead:id});
    }

    static onItem() {this.fire('item');}

    static onEnter() {this.fire('enter');}

    // TimeSystem 的 callback；一次跳好幾小時（睡覺）時，每跨過一個整點觸發一次
    static onTime(dt, time)
    {
        if(!(dt > 0)) {return;}
        const now = TimeSystem.toTotalMinutes(time);
        for(let h = Math.floor((now-dt)/60)+1; h*60 <= now; h++) {this.fire('time', _timeFacts(h%24));}
    }

    static _onQuality(name, v)
    {
        for(const t of Object.values(this._threads))
        {
            if(t.quality !== name || !t.values[v]) {continue;}
            const log = this.journal[t.id] ??= [];
            if(log.at(-1) === v) {continue;}
            log.push(v);
            this.updated.add(t.id);
            _popup('更新任務');
        }
        this.fire('quality');
    }

    //------------------------------------------------------
    //  任務日誌
    //------------------------------------------------------
    // {id, title, desc, done, pos, reward, lines:[{text, cur}]}
    static thread(id)
    {
        const t = this._threads[id];
        const log = this.journal[id];
        if(!t || !log?.length) {return null;}
        const vals = log.map(v=>t.values[v]).filter(Boolean);
        const last = vals.at(-1);
        const done = !!last?.end;
        return {
            id, title:t.title, desc:t.desc, done,
            pos: done ? null : last?.pos ?? null,
            reward: vals.findLast(v=>v.reward)?.reward,
            lines: vals.map((v,i)=>({text:_fill(v.journal), cur:!done && i===vals.length-1})),
        };
    }

    static threads() {return Object.keys(this.journal).map(id=>this.thread(id)).filter(Boolean);}

    //------------------------------------------------------
    //  除錯：右鍵 NPC →「劇情除錯」、debug 指令 story <npcId>
    //------------------------------------------------------
    // 條件式拆成一段一段，標出不成立的那段跟目前值
    static _explain(expr, ctx)
    {
        return String(expr).split(/(&&|\|\|)/).map(part=>{
            if(part === '&&' || part === '||') {return part;}
            if(evalCond(part, ctx)) {return `[color=green]${part.trim()}[/color]`;}
            const name = part.trim().replace(/^!/, '').split(/>=|<=|!=|==|=|>|</)[0];
            return `[color=red]${part.trim()}[/color](${name.trim()}=${valueOf(name, ctx)})`;
        }).join(' ');
    }

    static debug(npc)
    {
        const ctx = {npc, facts:worldFacts()};
        const cards = this._forNpc(this._storylets, npc);
        if(cards.length === 0) {return `${npc}：沒有 who 對得上的卡\n`;}
        let out = `[color=yellow]${npc} 的劇情卡[/color]\n`;
        for(const s of cards)
        {
            const ok = evalCond(s.requires, ctx);
            const tease = !ok && s.tease && evalCond(s.tease, ctx);
            const mark = ok ? '✅' : tease ? '🔒' : '❌';
            const kind = s.on ? `on:${s.on.join('/')}` : `「${s.label}」`;
            out += `${mark} ${s.id} ${kind}\n`;
            if(!ok && s.requires) {out += `    requires: ${this._explain(s.requires, ctx)}\n`;}
            if(!ok && !tease && s.tease) {out += `    tease: ${this._explain(s.tease, ctx)}\n`;}
        }
        return out;
    }

    // 目前這一行，去掉帶 {} 計數的括號區段（地圖節點提示用）
    static curLine(id)
    {
        const t = this._threads[id];
        const v = t?.values[this.journal[id]?.at(-1)];
        return v ? String(v.journal ?? '').replace(/\s*\([^)]*\{[^}]*\}[^)]*\)/g, '').trim() : '';
    }
}
