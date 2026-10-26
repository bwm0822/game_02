// NPC 主動（on:see、approach、BehApproach）：node scripts/test/approach.mjs
// 測試卡跟節點直接塞進 DB.story()，不動 story.json
import {run} from './harness.mjs'

const TOWN = 'm/m_04x05';

run('NPC 主動', async t => {
    await t.newGame();
    await t.gotoMap(TOWN);
    await t.eval(d => Object.assign(d.TimeSystem.time, {h:12, m:0}));
    t.ok('開新遊戲、到小鎮');

    await t.eval(d => {
        const s = d.DB.story();
        s.storylets.push(
            {id:'t_wave', who:'xi', on:['see'], requires:'!_t_wave', text:'嗨～', effects:['_t_wave=1']},
            {id:'t_call', who:'karen', on:['see'], requires:'!_t_call', text:'喂！等一下！', effects:['_t_call=1', 'approach n_t_call']},
        );
        (s.nodes.karen ??= {}).n_t_call = {texts:'我有話跟你說', next:'n_default'};
    });

    const wave = await t.eval(d => {
        const xi = d.objs().find(g => g.id === 'xi');
        d.Story.onSee(xi);
        d.Story.onSee(xi);
        return {q: d.Quality.get('xi._t_wave'), text: xi.coms.disp._spk.getElement('text').text, approach: xi.bb.approach ?? null};
    });
    t.eq('see：套用效果、同一個條件擋住第二次', wave.q, 1);
    t.eq('see：text 冒在 NPC 頭上', wave.text, '嗨～');
    t.eq('沒有 approach 就不會走過來', wave.approach, null);

    const call = await t.eval(d => {
        const karen = d.objs().find(g => g.id === 'karen');
        d.Story.onSee(karen);
        return karen.bb.approach;
    });
    t.eq('approach：記到 NPC 的黑板', call, 'n_t_call');

    const steps = await t.eval(async d => {
        const karen = d.objs().find(g => g.id === 'karen');
        const dlg = d.Ui.get(d.UI.TAG.DIALOG);
        const log = [];
        for (let i = 0; i < 150; i++)
        {
            const r = await Promise.race([karen.think(), new Promise(res => setTimeout(() => res('timeout'), 3000))]);
            log.push(`${karen.bb.beh}:${r?.note ?? r}@${Math.round(karen.pos.x)},${Math.round(karen.pos.y)}`);
            if (r === 'timeout' || dlg.isOpen) break;
        }
        return {n: log.length, open: dlg.isOpen, log: log.slice(-5).join(' | '), player: `${Math.round(d.GM.player.pos.x)},${Math.round(d.GM.player.pos.y)}`};
    });
    t.check('BehApproach 走到玩家旁邊、打開對話', steps.open, `${steps.n} 步，玩家 ${steps.player}，${steps.log}`);

    const opened = await t.eval(d => {
        const dlg = d.Ui.get(d.UI.TAG.DIALOG);
        const karen = d.objs().find(g => g.id === 'karen');
        return {A: dlg.dialog.A, B: dlg.dialog.B.map(b => b.text), approach: karen.bb.approach ?? null, beh: karen.bb.beh};
    });
    t.eq('直接進 approach 指定的節點', opened.A, '我有話跟你說');
    t.check('節點沿用 n_default 的選項', opened.B.includes('聊天') && opened.B.includes('離開'), opened.B.join('/'));
    t.eq('抵達後清掉 approach', opened.approach, null);
    t.eq('這回合是 APPROACH 行為', opened.beh, 'APPROACH');

    const busy = await t.eval(d => {
        const karen = d.objs().find(g => g.id === 'karen');
        const ai = karen.coms.ai;
        karen.bb.approach = 'n_t_call';
        const beh = ai.behaviors.find(b => b.name === 'APPROACH');
        const r = beh.score(ai.ctx);
        d.Ui.get(d.UI.TAG.DIALOG).close();
        return r[1];
    });
    t.eq('玩家在對話中不觸發', busy, 'player busy');

    const hate = await t.eval(d => {
        const karen = d.objs().find(g => g.id === 'karen');
        const ai = karen.coms.ai;
        d.Quality.set('karen.favor', 5);
        const r = ai.behaviors.find(b => b.name === 'APPROACH').score(ai.ctx);
        d.Quality.set('karen.favor', 50);
        return {why: r[1], approach: karen.bb.approach ?? null};
    });
    t.eq('好感 <=10 放棄搭話', hate.why, 'hates player');
    t.eq('放棄時清掉 approach', hate.approach, null);

    const seen = await t.eval(d => {
        d.DB.story().storylets.push({id:'t_see_n', who:'karen', on:['see'], effects:['t.see+1']});
        const karen = d.objs().find(g => g.id === 'karen');
        const ai = karen.coms.ai;
        const [sense, see] = [karen.sensePlayer, karen.canSee];
        karen.sensePlayer = () => d.GM.player;
        karen.bb.seePlayer = false;
        karen.canSee = () => true;
        ai._updateBB(ai.ctx);
        ai._updateBB(ai.ctx);
        const keep = d.Quality.get('t.see');
        karen.canSee = () => false;
        ai._updateBB(ai.ctx);
        karen.canSee = () => true;
        ai._updateBB(ai.ctx);
        [karen.sensePlayer, karen.canSee] = [sense, see];
        return [keep, d.Quality.get('t.see')];
    });
    t.eq('一直看著只觸發一次 see', seen[0], 1);
    t.eq('看不到再看到又觸發', seen[1], 2);
});
