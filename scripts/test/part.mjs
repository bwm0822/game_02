// 部位 pool（part.json）：node scripts/test/part.mjs
import {run} from './harness.mjs'
import {hiddenParts} from '../../src/core/equip.js'

const CAT = {CHESTPLATE: 'CAT_CHESTPLATE', BOOTS: 'CAT_BOOTS'};

run('部位 pool', async t => {
    const hide = (...its) => [...hiddenParts(its, CAT)].sort().join();
    t.eq('護甲藏衣服', hide({cat: 'CAT_CHESTPLATE', equip: {}}), 'cloth');
    t.eq('靴子藏鞋子', hide({cat: 'CAT_BOOTS', equip: {}}), 'shoes');
    t.eq('hideHair 藏頭髮、沒 equip 不算', hide({cat: 'CAT_HELMET', equip: {hideHair: true}}, {cat: 'CAT_CHESTPLATE'}, undefined), 'hair');

    await t.waitFor(d => d?.game.scene.isActive('MainMenu'), {what:'主選單'});
    t.eq('role 寫 id、DB.rolePart 查 part.json', await t.eval(d => d.DB.rolePart(d.DB.role('wick'), 'head')?.sprite), 'head-wick');
    t.eq('查不到 id 不畫', await t.eval(d => d.DB.rolePart({head:'nope'}, 'head') ?? null), null);
    t.eq('女角套 f', await t.eval(d => {
        d.DB._partDB['t-f'] = {kind:'cloth', sprite:'body-man', scale:0.25, y:1, f:{y:9}};
        return [d.DB.rolePart({cloth:'t-f'}, 'cloth').y, d.DB.rolePart({cloth:'t-f', sex:'f'}, 'cloth').y].join();
    }), '1,9');

    // 瑪莉穿上測試用的衣服（借 body-man 的圖）
    await t.eval(d => {d.DB.role('mary').cloth = 't-f';});
    await t.newGame('mary');
    // 角色 view 畫出的 sprite：RoleView 的 _shape
    const keys = await t.eval(d => {
        const v = Object.values(d.GM.player._coms ?? {}).find(c => c?._shape?.getAll);
        return v ? v._shape.getAll().map(sp => [sp.texture.key, sp.depth, sp.visible]) : null;
    });
    const has = (k) => keys?.find(([key]) => key === k);
    t.check('瑪莉畫出身體／頭／頭髮／手', ['body-woman', 'head-mary', 'hair-mary', 'hand-man'].every(has), JSON.stringify(keys));
    t.check('衣服深度 0.3、沒穿護甲時顯示', has('body-man')?.[1] === 0.3 && has('body-man')?.[2] === true, JSON.stringify(has('body-man')));
});
