// 盜賊討伐（討伐令）：node scripts/test/rogue.mjs
import {run} from './harness.mjs'

const FOREST = 'm/m_03x05';
const TOWN = 'm/m_04x05';
const GROUP = 'bandits';    // 黑森林的 @bandits 群組；裡面放哪幾種盜賊照地圖，測試只認群組不認 id
const LOOT = 'dagger-1';    // 任務要的匕首（群組裡至少一隻拿著）

run('盜賊討伐', async t => {
    const members = (d, g) => d.objs().filter(o => o.qid === g && o.isAlive !== false);
    const count = () => t.eval((d, g, src) => new Function('return ' + src)()(d, g).length, GROUP, members.toString());
    const killAll = () => t.eval((d, g, src) => {
        const l = new Function('return ' + src)()(d, g);
        l.forEach(o => o.takeDamage({amount: -99999}, d.GM.player));
        return l.length;
    }, GROUP, members.toString());

    await t.newGame();
    t.ok('開新遊戲');

    await t.gotoMap(FOREST);
    t.eq('接任務前黑森林沒有盜賊', await count(), 0);

    await t.gotoMap(TOWN);
    await t.talk('karen', '關於任務', '接受', '好');
    t.eq('跟 karen 接任務', await t.q('bandit_hunt'), 1);

    await t.gotoMap(FOREST);
    t.eq('還沒跟 xi 談，黑森林沒有盜賊', await count(), 0);

    await t.gotoMap(TOWN);
    const said = await t.talk('xi', '關於盜賊', '了解');
    t.eq('跟 xi 談完', await t.q('bandit_hunt'), 2);
    t.check('xi 說明盜賊的位置', said[1]?.includes('盜賊'), said[1]);

    await t.gotoMap(FOREST);
    const n = await count();
    t.check(`黑森林出現盜賊（${n} 個）`, n > 0);

    t.eq('計數器照群組數', await t.eval(d => d.Record.game.counters?.['bandit_hunt.kills']), 'kill:@bandits');
    const byGroup = await t.eval(d => {
        d.Story.onKill('rogue-1');
        const outside = d.Quality.get('bandit_hunt.kills');
        d.Story.onKill('bandit-1', 'bandits');
        const other = d.Quality.get('bandit_hunt.kills');
        d.Quality.set('bandit_hunt.kills', 0);
        return {outside, other};
    });
    t.eq('群組外的不算', byGroup.outside, 0);
    t.eq('群組裡的就算（不管 id）', byGroup.other, 1);

    t.eq('清光盜賊：殺了幾個', await killAll(), n);
    t.eq('清光盜賊：計數＝群組人數', await t.q('bandit_hunt.kills'), n);
    t.eq('任務進到取得匕首', await t.q('bandit_hunt'), 3);

    const loot = await t.eval((d, g, id) => d.objs().filter(o => o.qid === g && o.findEquip?.(i => (i.id ?? i) === id)).length, GROUP, LOOT);
    t.check('盜賊屍體上有匕首可以撿', loot > 0, `${loot} 具`);

    await t.give(LOOT);
    t.eq('拿到匕首', await t.q('bandit_hunt'), 4);

    await t.gotoMap(TOWN);
    const gold = await t.eval(d => d.GM.player.gold);
    await t.talk('karen', '關於任務', '完成了', '離開');
    t.eq('回報 karen', await t.q('bandit_hunt'), 10);
    t.eq('領到 100 金幣', await t.eval(d => d.GM.player.gold) - gold, 100);

    const j = await t.journal('bandit_hunt');
    t.check('日誌標成完成', j?.done, JSON.stringify(j));
    t.eq('日誌記到 5 行', j?.lines.length, 5);

    await t.gotoMap(FOREST);
    t.eq('任務完成後盜賊不再出現', await count(), 0);
});
