// dialog 改版（_common、line、next 沿用選項、n_cold、storylets 插入位置）：node scripts/test/dialog.mjs
import {run} from './harness.mjs'

const TOWN = 'm/m_04x05';

// 開對話、照順序點選項；回傳最後一步 NPC 說的話跟選項
function open(t, npc, ...labels)
{
    return t.eval((d, npc, labels) => {
        const who = d.objs().find(g => g.id === npc);
        who.talk();
        const dlg = d.Ui.get(d.UI.TAG.DIALOG);
        for (const l of labels)
        {
            const opt = dlg.dialog.B.find(b => b.text === l);
            if (!opt) throw new Error(`${npc} 沒有選項「${l}」，目前：${dlg.dialog.B.map(b => b.text).join('/')}`);
            dlg.owner.select(opt, dlg.cb.bind(dlg));
        }
        const out = {A: dlg.dialog.A, B: dlg.dialog.B.map(b => b.text)};
        dlg.close();
        return out;
    }, npc, labels);
}

const setHour = (t, h) => t.eval((d, h) => Object.assign(d.TimeSystem.time, {h, m:0}), h);

run('dialog 改版', async t => {
    await t.newGame();
    await t.gotoMap(TOWN);
    await setHour(t, 12);
    t.ok('開新遊戲、到小鎮');

    let r = await open(t, 'karen');
    t.eq('第一次見面：自己 sheet 的 greet（條件 +1 分）', r.A, '很高興認識你，我是Karen');
    t.check('n_default 有 _common 的聊天/離開 + 自己的交易', ['交易', '聊天', '離開'].every(l => r.B.includes(l)), r.B.join('/'));

    r = await open(t, 'karen');
    t.check('之後用 _common 的 greet', ['你好', '需要幫助嗎?'].includes(r.A), r.A);

    await setHour(t, 21);
    r = await open(t, 'karen');
    t.eq('晚上：time=night 的 greet 勝出', r.A, '這麼晚了還在外面晃？');
    await setHour(t, 12);

    r = await open(t, 'karen', '聊天', '這是哪裡?');
    t.check('n_where 的台詞', r.A.includes('晨曦小鎮'), r.A);
    t.check('n_where 沿用 n_chat 的選項，問過的不再出現', r.B.includes('沒事') && !r.B.includes('這是哪裡?') && r.B.includes('哪裡可以休息?'), r.B.join('/'));

    r = await open(t, 'karen', '聊天', '這是哪裡?', '沒事');
    t.check('回到 n_default', r.B.includes('聊天'), r.B.join('/'));

    await t.eval(d => d.DB.story().storylets.push(
        {id:'t_sorry', who:'karen', label:'道歉', mood:'cold'},
        {id:'t_job', who:'karen', label:'一般卡'},
    ));
    r = await open(t, 'karen');
    t.check('一般時有一般卡、沒有 cold 卡', r.B.includes('一般卡') && !r.B.includes('道歉'), r.B.join('/'));

    await t.setQ('karen.好感', 20);
    r = await open(t, 'karen');
    t.eq('好感 <=25 走 n_cold', r.A, '……又是你。');
    t.eq('n_cold 只有 mood=cold 的卡 + 離開', r.B.join('/'), '道歉/離開');

    const canTalk = await t.eval(d => {
        d.Quality.set('karen.好感', 5);
        const who = d.objs().find(g => g.id === 'karen');
        return who.coms.talk._canAct();
    });
    t.eq('好感 <=10 不能對話', canTalk, await t.eval(d => d.GM.HIDE));
    await t.setQ('karen.好感', 50);

    t.check('沒 sheet 的 unique NPC 也有 _common 對話', await t.eval(d => !!d.DB.dialog('trump')?.nodes.n_default), '');
    t.check('狼沒有對話', await t.eval(d => !d.DB.dialog('wolf')), '');
    t.eq('trump 是商人：trade 事實成立（_common 的交易選項會出現）', await t.eval(d => d.Line.facts('trump').trade), 1);
    t.eq('守衛不是商人：沒有交易選項', await t.eval(d => d.Line.facts('guard-1').trade), 0);
    t.eq('狼挨打吃 _common 的 line', await t.eval(d => d.Line.pick('wolf', 'underAtk', d.Line.facts('wolf'))), '找死!!!');
    t.eq('被偷的 line', await t.eval(d => d.Line.pick('xi', 'stolen', d.Line.facts('xi'))), '有小偷!!!');
});
