// 武器動畫（anim.json + COM_Anim.anim_play）：在遊戲裡揮劍、橫掃、瞄準，檢查影格姿勢、ready 等身體位移、hold 等 anim_end、播完回原位
// 動的是 wristF 節點（前手腕），武器掛在上面；待機＝body 的 wristF 支點
import {run} from './harness.mjs'

run('武器動畫', async t => {
    await t.waitFor(d => d?.game.scene.isActive('MainMenu'), {what:'主選單'});
    await t.eval(d => {
        const r = d.DB.role(d.DB.playerIds()[0]);
        d.DB._partDB[r.body] = {...d.DB._partDB[r.body], wristF: {x: -13, y: 18, a: 20}};
        delete r.handF;
    });
    await t.newGame();
    const r = await t.eval(async (d) => {
        // 動畫用固定資料，實際 anim.json 數值常調不會弄壞測試
        d.DB._animDB = await (await fetch('/scripts/test/fixtures/anim.json')).json();
        // 武器擺放也固定，實際 item.json 的 equip 常調
        Object.assign(d.DB._itemDB, {
            't-sword': {cat: 'CAT_WEAPON', type: 'melee', range: 1, atk: 15, equip: {sprite: 'sword-bronze', x: 1, y: -2, ox: 0.09375, oy: 0.875}},
            't-bow': {cat: 'CAT_WEAPON', type: 'ranged', range: 5, atk: 15, equip: {sprite: 'bow-short', x: 15, y: 24}},
        });
        const p = d.GM.player, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const pose = () => {const sp = p.view.wrist; return [Math.round(sp.x), Math.round(sp.y), Math.round(sp.angle)];};
        const right = {x: p.pos.x + 100, y: p.pos.y}, down = {x: p.pos.x, y: p.pos.y + 100};
        p.face(right);

        out.empty = [p.view.wrist, await p.anim_play('chop', right)];
        let drop = p.hold('t-sword');
        const rest = pose();
        out.rest = rest;
        const sw = p.view.wrist.list[0];
        out.swordLocal = [sw.x, sw.y];
        let readyAt = null;
        const hit = p.anim_play('chop', right, {ready: async () => {readyAt = pose(); await sleep(200);}});
        out.chopHit = [await hit, readyAt, pose()];
        await sleep(400);
        out.chopBack = pose();

        p.face(down);
        await p.anim_play('sweep', down);
        out.sweep = pose();
        await sleep(400);
        out.sweepBack = pose();
        drop();

        drop = p.hold('t-bow');
        const bowRest = pose();
        p.face(right);
        out.aim = [await p.anim_play('aim', right), pose()];
        await sleep(300);
        out.hold = pose();
        p.anim_end();
        await sleep(300);
        out.aimBack = [JSON.stringify(pose()) === JSON.stringify(bowRest)];
        drop();

        out.missing = await p.anim_play('nope', right);

        // 武器的手腕位移(equip.wristF／wristB)：穿上時手腕移過去；暫拿工具改用工具的(沒寫＝0)；播到一半放下，收回到武器的位置
        d.DB._itemDB['t-bow2'] = {cat: d.GM.CAT.WEAPON, type: 'ranged', range: 5, atk: 15, equip: {sprite: 'bow-short', x: 15, y: 24, wristF: {x: 4, y: -2, a: 10}, wristB: {x: 1, y: 1}}};
        {
            const eqs = p.bb.equips, saved = [...eqs];
            const wb = () => {const n = p.view._nodes.wristB; return [Math.round(n.x), Math.round(n.y)];};
            const wb0 = wb();
            const wear = (list) => {eqs.length = 0; eqs.push(...list); p.setDirty(); p.emit(d.GM.EVT.UPDATEEQUIP);};
            wear([{id: 't-bow2', count: 1}]);
            out.ofs = [pose(), wb()[0] - wb0[0], wb()[1] - wb0[1]];
            const put = p.hold('t-sword');
            out.ofs.push(pose());
            put();
            out.ofs.push(pose());
            const put2 = p.hold('t-sword');
            await p.anim_play('chop', right);
            put2();
            await sleep(400);
            out.ofs.push(pose());
            wear(saved);
            out.ofs.push(wb()[0] === wb0[0] && wb()[1] === wb0[1]);
        }

        // 普攻動畫看武器的 anim(item.json)，沒寫就預設 chop
        const eqs = p.bb.equips, saved = [...eqs], play = p.anim_play, played = [];
        p.anim_play = (id, ...a) => {played.push(id); return play(id, ...a);};
        const swing = async (id) => {eqs.length = 0; eqs.push({id, count: 1}); p.setDirty(); await p.anim_melee({pos: right}); return p.total.anim ?? null;};
        out.weaponAnim = [await swing('dagger-1'), await swing('t-sword')];
        out.played = played;
        p.anim_play = play;
        eqs.length = 0; eqs.push(...saved); p.setDirty();
        return out;
    });

    t.eq('沒手沒武器（wristF 空的）不播', JSON.stringify(r.empty), JSON.stringify([null, false]));
    t.eq('手腕靜止在 body 的 wristF 支點（含靜止角度 a）', JSON.stringify(r.rest), JSON.stringify([-13, 18, 20]));
    t.eq('劍掛在手腕上：本地座標＝equip 的數字（相對手腕）', JSON.stringify(r.swordLocal), JSON.stringify([1, -2]));
    t.eq('ready 時舉劍、hit 時劈到底', JSON.stringify(r.chopHit), JSON.stringify([true, [-13, 6, -90], [-8, 15, 75]]));
    t.eq('下劈播完收回', JSON.stringify(r.chopBack), JSON.stringify(r.rest));
    t.eq('橫掃朝下：整組繞支點轉 90°', JSON.stringify(r.sweep), JSON.stringify([-14, 0, -135]));   // Phaser 把 angle 換到 [-180, 180)，225＝-135
    t.eq('橫掃播完收回', JSON.stringify(r.sweepBack.slice(0, 2)), JSON.stringify(r.rest.slice(0, 2)));
    t.check('橫掃收回到靜止角度', (((r.sweepBack[2] - 20) % 360) + 360) % 360 === 0, JSON.stringify(r.sweepBack));
    t.eq('瞄準正右方', JSON.stringify(r.aim), JSON.stringify([true, [15, 10, 0]]));
    t.eq('hold：舉著等 anim_end', JSON.stringify(r.hold), JSON.stringify(r.aim[1]));
    t.check('anim_end 後收回', r.aimBack[0]);
    t.eq('沒有的動畫不播', r.missing, false);
    t.eq('武器手腕位移：穿上移過去、暫拿工具用工具的、放下恢復、播到一半放下收回武器位置、脫下回原位',
        JSON.stringify(r.ofs), JSON.stringify([[-9, 16, 30], 1, 1, [-13, 18, 20], [-9, 16, 30], [-9, 16, 30], true]));
    t.eq('武器 anim 帶進 total', JSON.stringify(r.weaponAnim), JSON.stringify(['stab', null]));
    t.eq('匕首普攻刺、劍普攻劈', JSON.stringify(r.played), JSON.stringify(['stab', 'chop']));
});
