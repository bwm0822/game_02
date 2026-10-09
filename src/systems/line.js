import DB from '../data/db.js'
import {evalCond} from './script.js'
import {worldFacts} from './story.js'
import {tr} from '../infra/lang.js'

//--------------------------------------------------
// rule-based 台詞（dialog.xlsx 的 section: line），見 docs/story-architecture.md §6.2
//  - 所有條件成立的 line 中，條件數最多的勝出；寫在 NPC 自己 sheet 的 +1 分；同分隨機
//  - 沒有 dialog 的角色（狼、盜賊…）只吃 _common 的 line
//--------------------------------------------------

const COMMON = '_common';

function _lines(npc) {return (DB.dialog(npc) ?? DB.dialog(COMMON))?.lines ?? [];}

function _conds(cond) {return cond ? String(cond).split('&&').length : 0;}

export default class Line
{
    // NPC 的情境事實（line 跟 dialog 條件共用）；root 有給才有 hp（血量比例 0～1）
    static facts(npc, root)
    {
        const meta = DB.role(npc);
        const f = {...worldFacts(), job:meta?.job, style:meta?.style, trade:meta?.trade ? 1 : 0};
        const t = root?.total;
        if(t?.hpMax) {f.hp = t.states.hp / t.hpMax;}
        return f;
    }

    // [{line, score}]，條件不成立的 score = -1
    static score(npc, concept, facts)
    {
        const ctx = {npc, facts};
        return _lines(npc).filter(l=>l.concept===concept).map(line=>({
            line,
            score: evalCond(line.condition, ctx) ? _conds(line.condition) + (line.own ? 1 : 0) : -1,
        }));
    }

    static pick(npc, concept, facts)
    {
        const ok = this.score(npc, concept, facts).filter(s=>s.score>=0);
        const best = Math.max(...ok.map(s=>s.score));
        const top = ok.filter(s=>s.score===best);
        const line = top.length ? top[Math.floor(Math.random()*top.length)].line : null;
        return line ? tr(line.ctx, line.text) : null;
    }

    static debug(npc)
    {
        const facts = this.facts(npc);
        const concepts = [...new Set(_lines(npc).map(l=>l.concept))];
        let out = `[color=yellow]${npc} 的台詞（line）[/color]\n`;
        for(const c of concepts)
        {
            const rows = this.score(npc, c, facts);
            const best = Math.max(...rows.map(r=>r.score));
            out += `${c}\n`;
            for(const {line, score} of rows)
            {
                const mark = score < 0 ? '❌' : score === best ? '▶' : '  ';
                out += `  ${mark} ${score<0 ? '-' : score} ${line.text}${line.condition ? ` [color=gray](${line.condition})[/color]` : ''}${line.own ? ' ★' : ''}\n`;
            }
        }
        return out;
    }
}
