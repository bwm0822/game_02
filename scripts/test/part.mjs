// 部位 pool（part.json）：node scripts/test/part.mjs
import {run} from './harness.mjs'
import {hiddenParts, atPivot, fromPivot} from '../../src/core/equip.js'

const CAT = {CHESTPLATE: 'CAT_CHESTPLATE', BOOTS: 'CAT_BOOTS', GLOVES: 'CAT_GLOVES'};

run('部位 pool', async t => {
    const hide = (...its) => [...hiddenParts(its, CAT)].sort().join();
    t.eq('護甲藏衣服', hide({cat: 'CAT_CHESTPLATE', equip: {}}), 'cloth');
    t.eq('靴子藏鞋子', hide({cat: 'CAT_BOOTS', equip: {}}), 'shoes');
    t.eq('手套藏兩隻手', hide({cat: 'CAT_GLOVES', equip: {}}), 'handB,handF');
    const r2 = (p) => [p.x, p.y, p.a].map(v => Math.round(v * 1000) / 1000).join();
    const pv = {x: 1, y: 2, a: 90};
    t.eq('atPivot：繞支點轉 a、角度疊上去', r2(atPivot({x: 10, y: 0, a: 5}, pv)), '1,12,95');
    t.eq('fromPivot 是反過來', r2(fromPivot(atPivot({x: 3, y: -4, a: 7}, pv), pv)), '3,-4,7');
    t.eq('hideHair 藏頭髮、沒 equip 不算', hide({cat: 'CAT_HELMET', equip: {hideHair: true}}, {cat: 'CAT_CHESTPLATE'}, undefined), 'hair');

    await t.waitFor(d => d?.game.scene.isActive('MainMenu'), {what:'主選單'});
    t.eq('role 寫 id、DB.rolePart 查 part.json', await t.eval(d => d.DB.rolePart(d.DB.role('wick'), 'head')?.sprite), 'head-wick');
    t.eq('查不到 id 不畫', await t.eval(d => d.DB.rolePart({head:'nope'}, 'head') ?? null), null);
    t.eq('女角套 f', await t.eval(d => {
        d.DB._partDB['t-f'] = {kind:'cloth', sprite:'body-man', scale:0.25, y:1, f:{y:9}};
        return [d.DB.rolePart({cloth:'t-f'}, 'cloth').y, d.DB.rolePart({cloth:'t-f', sex:'f'}, 'cloth').y].join();
    }), '1,9');

    // 瑪莉穿上測試用的衣服（借 body-man 的圖）、前後手（借 hand-man 的圖）、脖子／前手腕支點（女版 f 蓋過基準）
    await t.eval(d => {
        const m = d.DB.role('mary');
        d.DB._partDB['t-hf'] = {kind:'handF', sprite:'hand-man', scale:0.25, x:3, y:30};
        d.DB._partDB['t-hb'] = {kind:'handB', sprite:'hand-man', scale:0.25, y:31};
        d.DB._partDB[m.body] = {...d.DB._partDB[m.body], neck:{x:1, y:-40, a:30}, wristF:{x:5, y:20}};
        Object.assign(m, {cloth:'t-f', handF:'t-hf', handB:'t-hb'});
    });
    await t.newGame('mary');
    // 角色 view 畫出的 sprite：RoleView 的 _shape，支點節點裡的另外記節點名
    const keys = await t.eval(d => {
        const v = Object.values(d.GM.player._coms ?? {}).find(c => c?._shape?.getAll);
        const node = (c) => Object.keys(v._nodes).find(k => v._nodes[k] === c) ?? '';
        return v ? v.sprites.map(sp => [sp.texture.key, sp.depth, sp.visible, node(sp.parentContainer), sp.x + sp.parentContainer.x, sp.y + sp.parentContainer.y, sp.y]) : null;
    });
    const has = (k, n) => keys?.find(([key, , , node]) => key === k && (n === undefined || node === n));
    t.check('瑪莉畫出身體／頭／頭髮／前後手', ['body-woman', 'head-mary', 'hair-mary'].every(k => has(k)) && has('hand-man', 'wristF') && has('hand-man', 'wristB'), JSON.stringify(keys));
    t.check('衣服深度 0.7（靴子之上）、沒穿護甲時顯示', has('body-man')?.[1] === 0.7 && has('body-man')?.[2] === true, JSON.stringify(has('body-man')));
    t.eq('頭、頭髮掛 neck、前手掛 wristF、後手掛 wristB', [has('head-mary')?.[3], has('hair-mary')?.[3]].join(), 'neck,neck');
    const head = await t.eval(d => d.DB.rolePart(d.DB.role('mary'), 'head').y);
    t.eq('子部位數字相對支點（跟著支點走）', JSON.stringify([has('head-mary')?.[5], has('head-mary')?.[6], has('hand-man', 'wristF')?.[4], has('hand-man', 'wristF')?.[5]]),
        JSON.stringify([head - 40, head, 8, 50]));
    t.eq('節點整組照 NODE_DEPTH 排：wristB 在 body 前面（底層）', await t.eval(d => {
        const v = Object.values(d.GM.player._coms ?? {}).find(c => c?._shape?.getAll);
        return v._rig.getAll().map(c => Object.keys(v._nodes).find(k => v._nodes[k] === c) ?? c.texture.key).slice(0, 2).join();
    }), 'wristB,body-woman');
    t.eq('rig＝body 的 x/y、身體圖在 rig 的 0,0、支點跟衣服掛在 rig 上', await t.eval(d => {
        const v = Object.values(d.GM.player._coms).find(c => c?._rig), b = v._rig.list.find(c => c.texture?.key === 'body-woman');
        const cloth = v._rig.list.find(c => c.texture?.key === 'body-man');
        return [v._rig.parentContainer === v._shape, v._rig.x, v._rig.y, b.x, b.y, v._nodes.neck.parentContainer === v._rig, !!cloth].join();
    }), 'true,0,32,0,0,true,true');
    t.eq('支點的 a＝節點靜止角度', await t.eval(d => Object.values(d.GM.player._coms).find(c => c?._nodes)._nodes.neck.angle), 30);
    t.eq('播動畫動的是 wristF 節點', await t.eval(d => d.GM.player.view.wrist === Object.values(d.GM.player._coms).find(c => c?._nodes)._nodes.wristF), true);
});
