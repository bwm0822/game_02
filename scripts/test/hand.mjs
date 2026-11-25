// 手持道具（CAT_EQUIP，如火把）：照 equip.hand 掛手腕、跟武器搶同一隻手擋著不能裝：node scripts/test/hand.mjs
import {run} from './harness.mjs'

run('手持道具', async t => {
    await t.waitFor(d => d?.game.scene.isActive('MainMenu'), {what:'主選單'});
    await t.newGame();

    const r = await t.eval(async d => {
        const {default: UiDragged} = await import('/src/ui/uidragged.js');
        const {default: UiInv} = await import('/src/ui/uiinv.js');
        const {heldOf, handItems, handClash} = await import('/src/core/equip.js');
        const C = d.GM.CAT, p = d.GM.player, out = {};
        Object.assign(d.DB._itemDB, {
            't-sword': {cat: C.WEAPON, equip: {sprite: 'sword-bronze', x: 1, y: -2, wristB: {x: 9}}},
            't-bow': {cat: C.WEAPON, equip: {sprite: 'bow-short', x: 15, y: 24, hand: 'B'}},
            't-torch': {cat: C.EQUIP, equip: {sprite: 'sword-iron', x: 0, y: 0, hand: 'B', wristB: {x: 2, y: -3}}},
            't-torchF': {cat: C.EQUIP, equip: {sprite: 'sword-iron', x: 0, y: 0}},
            't-bag': {cat: C.BAG, storage: 4},
        });
        const it = (id) => d.DB.item(id);

        // 純函式：同一隻手才撞、沒有 equip 不算、武器優先、位移疊上去（道具只加自己那隻手）
        out.clash = [handClash(it('t-bow'), it('t-torch'), C), handClash(it('t-sword'), it('t-torch'), C), handClash(it('t-sword'), it('t-torchF'), C),
                     handClash(it('t-bag'), it('t-torch'), C)];
        out.items = handItems([it('t-torch'), it('t-bow')], C).map(o => o.equip.sprite);
        out.held = JSON.stringify(heldOf([it('t-sword'), it('t-torch')], C));

        const slots = [];
        UiInv.instance._equips.loop(s => s && slots.push(s));
        const wslot = slots.find(s => s.cat === C.WEAPON), eslot = slots.find(s => (s.cat & C.EQUIP) === C.EQUIP);
        for (const s of [wslot, eslot]) s.owner = p;
        const was = UiDragged.instance._obj;
        const canDrop = (slot, id) => {UiDragged.instance._obj = {dat: it(id)}; return slot.isValid;};

        wslot.content = {id: 't-bow', count: 1};
        out.bow = [canDrop(eslot, 't-torch'), eslot.handBlock(it('t-torch'))?.equip.sprite, canDrop(eslot, 't-torchF'), canDrop(eslot, 't-bag')];
        wslot.content = {id: 't-sword', count: 1};
        out.sword = canDrop(eslot, 't-torch');
        eslot.content = {id: 't-torch', count: 1};
        // 拿著火把（後手）換弓：武器格也擋
        out.swap = [canDrop(wslot, 't-bow'), canDrop(wslot, 't-sword')];
        UiDragged.instance._obj = was;

        // 角色身上：火把掛 wristB、劍在 wristF，後手腕＝body 支點＋劍的 wristB＋火把的 wristB
        const wf = p.view._nodes.wristF, wb = p.view._nodes.wristB;
        const has = (n, key) => n.list.some(s => s.texture?.key === key);
        const body = d.DB.rolePart(p.bb.meta, 'body');
        out.drawn = [has(wb, 'sword-iron'), has(wf, 'sword-bronze'), !has(wf, 'sword-iron'),
                     Math.round(wb.pivot.x - (body.wristB?.x ?? 0)), Math.round(wb.pivot.y - (body.wristB?.y ?? 0))];

        // equip.parts：粒子發射點／光源每幀跟著零件的世界位置；不 local 的在 rig 裡、排在後手節點正上方（under＝正下方）；
        // local 的進 holder（道具前面，under＝道具後面的另一個 holder）；off／什麼都不是的不建；卸下清掉
        d.DB._particleDB['t-fire'] = {img: 'p-square', speedY: -20, lifespan: 300, frequency: 50};
        d.DB._particleDB['t-loc'] = {img: 'p-square', speedY: -20, lifespan: 300, frequency: 50, local: true};
        it('t-torch').equip.parts = [{particle: 't-fire', x: 3, y: -35}, {light: {r: 60, i: 1.5, breath: {t: 2, min: 0.5}}, x: 3, y: -35}, {particle: 't-fire', y: -10, under: true},
                                     {particle: 't-loc'}, {particle: 't-loc', under: true}, {light: {r: 60}, off: true}, {particle: 't-fire', off: true}, {x: 1}];
        const lights0 = p.scene.lights.lights.length;
        p.view._updateEquips();
        {
            const live = p.view._eqParts?.[0], holder = live?.holder;
            const w = holder.getWorldTransformMatrix().transformPoint(3, -35);
            const ems = live.pts.filter(o => o.fx).map(o => o.fx.emitter), lt = live.pts.find(o => o.light), rig = wb.parentContainer;
            const l = rig.getWorldTransformMatrix().applyInverse(w.x, w.y);
            const under = wb.list.find(c => c !== holder && c.type === 'Container');
            const sprite = wb.list.find(c => c.texture?.key === 'sword-iron');
            out.parts = [holder.parentContainer === wb, live.pts.length, ems.length, p.scene.lights.lights.length - lights0,
                         Math.round(ems[0].x) === Math.round(l.x) && Math.round(ems[0].y) === Math.round(l.y),
                         Math.round(lt.light.x) === Math.round(w.x) && Math.round(lt.light.y) === Math.round(w.y),
                         ems[0].parentContainer === rig && rig.getIndex(ems[0]) === rig.getIndex(wb) + 1,
                         ems[1].parentContainer === rig && rig.getIndex(ems[1]) === rig.getIndex(wb) - 1,
                         holder.list.length, under?.list.length, wb.getIndex(under) < wb.getIndex(sprite), wb.getIndex(holder) > wb.getIndex(sprite)];
            out.breath = lt.light.breath && [lt.light.breath.t, lt.light.breath.min, lt.light.breath.base];
            p.view._removeEquips();
            out.parts.push(p.scene.lights.lights.length === lights0, !p.view._eqParts);
            delete it('t-torch').equip.parts;
            p.view._updateEquips();
        }

        // 舊存檔／NPC 撞手（弓＋火把）：武器優先、火把不畫
        p.bb.equips[wslot._i] = {id: 't-bow', count: 1};
        p.view._updateEquips();
        out.old = [has(wb, 'bow-short'), has(wb, 'sword-iron')];
        p.bb.equips[wslot._i] = null;
        p.bb.equips[eslot._i] = null;
        p.view._updateEquips();
        return out;
    });
    t.eq('手上光源零件的呼吸：breath＋基準＝i', JSON.stringify(r.breath), '[2,0.5,1.5]');
    t.eq('同一隻手才撞；沒 equip 的不算', JSON.stringify(r.clash), '[true,false,true,false]');
    t.eq('撞手時武器優先', JSON.stringify(r.items), '["bow-short"]');
    t.eq('手腕位移：武器的＋道具自己那隻手的', r.held, JSON.stringify({sprite: 'sword-bronze', x: 1, y: -2, wristB: {x: 11, y: -3, a: 0}}));
    t.eq('拿弓：後手的火把擋下（找得到是誰）、前手的可以、背包不管', JSON.stringify(r.bow), '[false,"bow-short",true,true]');
    t.check('拿劍：後手的火把可以裝', r.sword);
    t.eq('拿著後手火把：武器格擋弓、劍可以', JSON.stringify(r.swap), '[false,true]');
    t.eq('火把畫在後手腕、劍在前手腕、後手腕加上劍跟火把的位移', JSON.stringify(r.drawn), '[true,true,true,11,-3]');
    t.eq('舊資料撞手：只畫弓', JSON.stringify(r.old), '[true,false]');
    t.eq('equip.parts：掛在後手腕、off 跟空的不建、粒子（rig 裡、後手節點正上方／under 正下方）／光源跟著零件位置、local 進 holder（under 在道具後面）；卸下清掉',
         JSON.stringify(r.parts), '[true,3,2,1,true,true,true,true,1,1,true,true,true,true]');
});
