// 盜賊討伐（討伐令）：node scripts/test/rogue.mjs
import {run} from './harness.mjs'

const FOREST = 'm/m_03x05';
const TOWN = 'm/m_04x05';

run('盜賊討伐', async t => {
    await t.newGame();
    t.ok('開新遊戲');

    await t.gotoMap(FOREST);
    t.eq('接任務前黑森林沒有盜賊', await t.count('rogue-1'), 0);

    await t.gotoMap(TOWN);
    await t.talk('karen', '關於任務', '接受', '好');
    t.eq('跟 karen 接任務', await t.q('討伐令'), 1);

    await t.gotoMap(FOREST);
    t.eq('還沒跟 xi 談，黑森林沒有盜賊', await t.count('rogue-1'), 0);

    await t.gotoMap(TOWN);
    const said = await t.talk('xi', '關於盜賊', '了解');
    t.eq('跟 xi 談完', await t.q('討伐令'), 2);
    t.check('xi 說明盜賊的位置', said[1]?.includes('盜賊'), said[1]);

    await t.gotoMap(FOREST);
    t.eq('黑森林出現 3 個盜賊', await t.count('rogue-1'), 3);

    await t.kill('rogue-1');
    t.eq('清光盜賊', await t.q('討伐令.殺盜賊'), 3);
    t.eq('任務進到取得匕首', await t.q('討伐令'), 3);

    const loot = await t.eval(d => d.objs().filter(g => g.id === 'rogue-1' && g.findEquip?.(i => (i.id ?? i) === 'sword_01')).length);
    t.eq('盜賊屍體上有匕首可以撿', loot, 3);

    await t.give('sword_01');
    t.eq('拿到匕首', await t.q('討伐令'), 4);

    await t.gotoMap(TOWN);
    const gold = await t.eval(d => d.GM.player.gold);
    await t.talk('karen', '關於任務', '完成了', '離開');
    t.eq('回報 karen', await t.q('討伐令'), 10);
    t.eq('領到 100 金幣', await t.eval(d => d.GM.player.gold) - gold, 100);

    const j = await t.journal('討伐令');
    t.check('日誌標成完成', j?.done, JSON.stringify(j));
    t.eq('日誌記到 5 行', j?.lines.length, 5);

    await t.gotoMap(FOREST);
    t.eq('任務完成後盜賊不再出現', await t.count('rogue-1'), 0);
});
