// 武器動畫（anim.json + COM_Anim.anim_play）：在遊戲裡揮劍、橫掃、瞄準，檢查影格姿勢、ready 等身體位移、hold 等 anim_end、播完回原位
// 動的是拿武器那隻手的手腕節點（沒寫 hand＝wristF 前手腕，hand 'B'＝wristB 後手腕），武器掛在上面；待機＝body 的那個支點
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

        // 拿在後手的武器(equip.hand 'B'，如弓)：掛在 wristB、動畫動 wristB、前手不動；放下後回到前手
        d.DB._itemDB['t-bowB'] = {cat: d.GM.CAT.WEAPON, type: 'ranged', range: 5, atk: 15, equip: {sprite: 'bow-short', x: 15, y: 24, hand: 'B'}};
        {
            const wf = p.view._nodes.wristF, wbN = p.view._nodes.wristB, nums = (n) => JSON.stringify([n.x, n.y, n.angle].map(Math.round));
            const f0 = nums(wf);
            const dropB = p.hold('t-bowB');
            const restB = pose();
            out.back = [p.view.wrist === wbN, wbN.list.some(s => s.texture?.key === 'bow-short'), !wf.list.some(s => s.texture?.key === 'bow-short'),
                        JSON.stringify(restB) === JSON.stringify([wbN.pivot.x, wbN.pivot.y, wbN.pivot.a].map(Math.round))];
            // 播動畫時後手整組搬到頭、身體前面、前手後面（NODE_DEPTH_ANIM），收回才搬回去
            const rig = wbN.parentContainer, at = (n) => rig.getIndex(n), neck = p.view._nodes.neck;
            out.lift = [wbN.depth, at(wbN) < at(neck)];
            out.backAim = [await p.anim_play('aim', right), pose(), nums(wf) === f0];
            out.lift.push(wbN.depth, at(wbN) > at(neck) && at(wbN) < at(wf));
            p.anim_end();
            await sleep(300);
            out.backAim.push(JSON.stringify(pose()) === JSON.stringify(restB));
            out.lift.push(wbN.depth, at(wbN) < at(neck));
            // 舉著等時被下一個動畫打斷(_stop)：先搬回，新動畫再搬上去；收回那段還在前面
            await p.anim_play('aim', right);
            p.anim_end();
            await sleep(20);
            out.lift.push(wbN.depth);
            dropB();
            out.backDrop = [p.view.wrist !== wbN, !wbN.list.some(s => s.texture?.key === 'bow-short')];
        }

        // otherKeys：另一隻手(這裡是前手，戴手套讓 wristF 有東西)自己一排影格(rig 座標)，比弓晚結束(end＝120)，弓停住等；轉向一樣繞支點轉，收回回原位
        d.DB._animDB.aimO = {...d.DB._animDB.aim, otherKeys: [{t: 60, x: 15, y: -4, a: 10, ease: 'Quad.Out'}, {t: 120, x: 5, y: -4, a: 10}]};
        {
            const eqs = p.bb.equips, saved = [...eqs];
            const wear = (list) => {eqs.length = 0; eqs.push(...list); p.setDirty(); p.emit(d.GM.EVT.UPDATEEQUIP);};
            wear([{id: 'gloves_01', count: 1}]);
            const wf = p.view._nodes.wristF, nums = (n) => [n.x, n.y, n.angle].map(Math.round);
            const f0 = nums(wf);
            const dropO = p.hold('t-bowB');
            out.other = [p.view.otherWrist === wf];
            await p.anim_play('aimO', right);
            out.other.push(pose(), nums(wf));
            await sleep(150);
            out.other.push(pose(), nums(wf));
            p.anim_end();
            await sleep(300);
            out.other.push(JSON.stringify(nums(wf)) === JSON.stringify(f0));
            p.face(down);
            await p.anim_play('aimO', down);
            out.otherTurn = nums(wf);
            p.anim_end();
            await sleep(300);
            out.otherTurn.push(JSON.stringify(nums(wf)) === JSON.stringify(f0));
            dropO();
            p.face(right);
            wear(saved);
        }

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
    t.eq('後手武器（hand B）：掛在 wristB、動畫動 wristB、靜止在 wristB 支點', JSON.stringify(r.back), JSON.stringify([true, true, true, true]));
    t.eq('後手武器瞄準：同一個 aim 影格（絕對姿勢）、前手不動、anim_end 收回', JSON.stringify(r.backAim), JSON.stringify([true, [15, 10, 0], true, true]));
    t.eq('後手射箭：播動畫時整組搬到頭前面、前手後面（3），收回搬回（-1），收回那段還在前面', JSON.stringify(r.lift), JSON.stringify([-1, true, 3, true, -1, true, 3]));
    t.eq('放下後手武器：wrist 不再是 wristB、弓拿掉', JSON.stringify(r.backDrop), JSON.stringify([true, true]));
    t.eq('otherKeys：hit 時前手在第一格、弓停住等前手拉到第二格（end 取兩排最晚）、anim_end 收回原位',
        JSON.stringify(r.other), JSON.stringify([true, [15, 10, 0], [15, -4, 10], [15, 10, 0], [5, -4, 10], true]));
    t.eq('otherKeys：轉向目標時前手的影格一樣繞支點轉', JSON.stringify(r.otherTurn), JSON.stringify([14, 25, 100, true]));
    t.eq('武器手腕位移：穿上移過去、暫拿工具用工具的、放下恢復、播到一半放下收回武器位置、脫下回原位',
        JSON.stringify(r.ofs), JSON.stringify([[-9, 16, 30], 1, 1, [-13, 18, 20], [-9, 16, 30], [-9, 16, 30], true]));
    t.eq('武器 anim 帶進 total', JSON.stringify(r.weaponAnim), JSON.stringify(['stab', null]));
    t.eq('匕首普攻刺、劍普攻劈', JSON.stringify(r.played), JSON.stringify(['stab', 'chop']));
});
