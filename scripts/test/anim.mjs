// 武器動畫（anim.json + COM_Anim.anim_play）：在遊戲裡揮劍、橫掃、瞄準，檢查影格姿勢、ready 等身體位移、hold 等 anim_end、播完回原位
import {run} from './harness.mjs'

run('武器動畫', async t => {
    await t.newGame();
    const r = await t.eval(async (d) => {
        const p = d.GM.player, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const pose = () => {const sp = p.view.weapon; return [Math.round(sp.x), Math.round(sp.y), Math.round(sp.angle)];};
        const right = {x: p.pos.x + 100, y: p.pos.y}, down = {x: p.pos.x, y: p.pos.y + 100};
        p.face(right);

        let drop = p.hold('sword_01');
        const rest = pose();
        out.rest = rest;
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

        drop = p.hold('bow_01');
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
        return out;
    });

    t.eq('劍靜止：原點在握把', JSON.stringify(r.rest), JSON.stringify([-13, 18, 0]));
    t.eq('ready 時舉劍、hit 時劈到底', JSON.stringify(r.chopHit), JSON.stringify([true, [-13, 6, -90], [-8, 15, 75]]));
    t.eq('下劈播完收回', JSON.stringify(r.chopBack), JSON.stringify(r.rest));
    t.eq('橫掃朝下：整組繞支點轉 90°', JSON.stringify(r.sweep), JSON.stringify([-14, 0, -135]));   // Phaser 把 angle 換到 [-180, 180)，225＝-135
    t.eq('橫掃播完收回', JSON.stringify(r.sweepBack.slice(0, 2)), JSON.stringify(r.rest.slice(0, 2)));
    t.check('橫掃收回角度', ((r.sweepBack[2] % 360) + 360) % 360 === 0, JSON.stringify(r.sweepBack));
    t.eq('瞄準正右方', JSON.stringify(r.aim), JSON.stringify([true, [26, 19, -45]]));
    t.eq('hold：舉著等 anim_end', JSON.stringify(r.hold), JSON.stringify(r.aim[1]));
    t.check('anim_end 後收回', r.aimBack[0]);
    t.eq('沒有的動畫不播', r.missing, false);
});
