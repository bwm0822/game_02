// 事件卡 enter/time 與情境事實：node scripts/test/events.mjs
// 測試卡直接塞進 DB.story().storylets，不動 story.xlsx
import {run} from './harness.mjs'

const FOREST = 'm/m_03x05';
const TOWN = 'm/m_04x05';

run('事件卡 enter/time', async t => {
    await t.newGame();
    t.ok('開新遊戲');

    await t.eval(d => d.DB.story().storylets.push(
        {id:'t_enter', on:['enter'], requires:'map==m/m_03x05', effects:['t.enter+1']},
        {id:'t_hour', on:['time'], effects:['t.hour+1']},
        {id:'t_night', on:['time'], requires:'hour==20 && time=night', effects:['t.night=1']},
        {id:'t_talk', who:'karen', requires:'time=night', label:'夜間測試'},
    ));

    await t.gotoMap(FOREST);
    t.eq('進黑森林觸發 enter', await t.q('t.enter'), 1);
    await t.gotoMap(TOWN);
    t.eq('進別的地圖不觸發', await t.q('t.enter'), 1);
    await t.gotoMap(FOREST);
    t.eq('再進黑森林又觸發一次', await t.q('t.enter'), 2);

    const hours = await t.eval(async d => {
        Object.assign(d.TimeSystem.time, {h:19, m:30});
        const before = d.Quality.get('t.hour');
        await d.TimeSystem.inc(150);
        return d.Quality.get('t.hour') - before;
    });
    t.eq('19:30 → 22:00 跨過 3 個整點', hours, 3);
    t.eq('20:00 觸發時 hour/time 事實正確', await t.q('t.night'), 1);

    const talk = await t.eval(d => d.Story.talkCards('karen').map(c => c.card.id));
    t.check('對話卡讀得到 time=night', talk.includes('t_talk'), talk.join('/'));

    const day = await t.eval(d => {
        Object.assign(d.TimeSystem.time, {h:12, m:0});
        return d.Story.talkCards('karen').map(c => c.card.id);
    });
    t.check('白天沒有夜間對話卡', !day.includes('t_talk'), day.join('/'));
});
