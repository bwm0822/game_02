// 聚光燈：Light2D 換成 core/spotlight.js 的 pipeline、錐外不亮、鏡像方向照得到、超過 1 的光柔性壓縮
import {run} from './harness.mjs'

run('spotlight', async t => {
    await t.newGame();

    t.eq('Light2D 換成聚光燈版', await t.eval(d => d.game.renderer.pipelines.get('Light2D')?.constructor.name), 'SpotLightPipeline');

    const r = await t.eval(async d => {
        const gs = d.game.scene.getScene('GameScene');
        const {setSpot} = await import('/src/core/spotlight.js');
        const frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
        const pixel = (x, y) => new Promise(res => d.game.renderer.snapshotPixel(Math.round(x), Math.round(y), c => res(c.r + c.g + c.b)));
        const cam = gs.cameras.main, p = d.GM.player;
        const amb0 = gs.lights.ambientColor.color;
        gs.lights.setAmbientColor(0x000000);
        const saved = gs.lights.lights.map(l => [l, l.intensity]);
        saved.forEach(([l]) => l.intensity = 0);
        const sx = (p.x - cam.worldView.x) * cam.zoom, sy = (p.y - cam.worldView.y) * cam.zoom;
        const L = gs.lights.addLight(p.x, p.y, 300, 0xffffff, 1);
        const at = async () => { await frame(); return {left: await pixel(sx - 60, sy), right: await pixel(sx + 60, sy), up: await pixel(sx, sy - 60)}; };
        const point = await at();
        setSpot(L, {dir: 0, arc: 60});
        const right = await at();
        setSpot(L, {dir: 180, arc: 60});
        const left = await at();
        setSpot(L, {dir: 270, arc: 60});
        const up = await at();
        // 環境光不被壓暗：0xcccccc 跟 0xffffff 的亮度比＝0.8；疊三盞燈也不比全白環境光亮
        L.intensity = 0;
        const amb = async (c) => {gs.lights.setAmbientColor(c); await frame(); return pixel(sx + 60, sy);};
        const full = await amb(0xffffff), part = await amb(0xcccccc);
        gs.lights.setAmbientColor(0x666666);
        setSpot(L, {});
        L.intensity = 1;
        const more = [gs.lights.addLight(p.x, p.y, 300, 0xffffff, 1), gs.lights.addLight(p.x, p.y, 300, 0xffffff, 1)];
        await frame();
        const stacked = await pixel(sx + 60, sy);
        more.forEach(l => gs.lights.removeLight(l));
        const ambRes = {ratio: part / full, full, stacked};
        gs.lights.removeLight(L);
        saved.forEach(([l, i]) => l.intensity = i);
        gs.lights.setAmbientColor(amb0);
        return {point, right, left, up, ambRes};
    });
    t.check('全白環境光不被壓暗（0xcccccc／0xffffff ≈ 0.8）', Math.abs(r.ambRes.ratio - 0.8) < 0.03, JSON.stringify(r.ambRes));
    t.check('疊三盞燈不比全白環境光亮（不爆白）', r.ambRes.stacked <= r.ambRes.full && r.ambRes.stacked > 0, JSON.stringify(r.ambRes));
    t.check('點光源左右都亮', r.point.left > 0 && r.point.right > 0, JSON.stringify(r.point));
    t.check('朝右(dir 0)：右亮、左暗', r.right.right > 0 && r.right.left === 0, JSON.stringify(r.right));
    t.check('朝左(dir 180)：左亮、右暗', r.left.left > 0 && r.left.right === 0, JSON.stringify(r.left));
    t.check('朝上(dir 270)：上亮、左右暗', r.up.up > 0 && r.up.left === 0 && r.up.right === 0, JSON.stringify(r.up));

    // 呼吸：light.breath，pipeline 每幀照時間算 intensity（min～1 倍）、每盞隨機起點、池子拿回來的燈清掉
    const b = await t.eval(async d => {
        const gs = d.game.scene.getScene('GameScene');
        const {setBreath, breathAt, breathOf} = await import('/src/core/spotlight.js');
        const frame = () => new Promise(res => requestAnimationFrame(res));
        const out = {};
        out.math = [breathAt({t: 2, min: 0.6, ph: 0}, 0), breathAt({t: 2, min: 0.6, ph: 0}, 1), breathAt({t: 2, min: 0.6, ph: 0}, 2)].map(v => Math.round(v * 1000) / 1000);
        out.tiled = [breathOf({breath_t: 3, breath_min: 0.5}), breathOf({}), breathOf({breath: {t: 1}})];
        const L = setBreath(gs.lights.addLight(0, 0, 100, 0xffffff, 1), {t: 0.5, min: 0.2}, 2);
        const M = setBreath(gs.lights.addLight(0, 0, 100, 0xffffff, 1), {t: 0.5, min: 0.2}, 2);
        out.data = [L.breath.t, L.breath.min, L.breath.base, L.breath.ph >= 0 && L.breath.ph < 1, L.breath.ph !== M.breath.ph];
        const seen = [];
        const t0 = performance.now();
        while (performance.now() - t0 < 800) {await frame(); seen.push(L.intensity);}
        out.range = [Math.min(...seen), Math.max(...seen)].map(v => Math.round(v * 100) / 100);
        // 改基準（藏起來＝0）：起點不變、亮度 0
        const ph = L.breath.ph;
        setBreath(L, {t: 0.5, min: 0.2}, 0);
        await frame();
        out.hidden = [L.breath.ph === ph, L.intensity];
        // 拿掉呼吸：回到基準；池子拿回來的燈 setBreath(null) 清掉
        setBreath(L, null, 1.5);
        await frame();
        out.off = [L.breath, L.intensity];
        gs.lights.removeLight(L);
        gs.lights.removeLight(M);
        const N = setBreath(gs.lights.addLight(0, 0, 100, 0xffffff, 1), null, 1);
        out.pool = [N.breath, N.intensity];
        // 夾範圍：min 0～1、t 最少 0.1、沒有 t＝不呼吸
        out.clamp = [setBreath(N, {t: 0.01, min: 3}, 1).breath, setBreath(N, {min: 0.5}, 1).breath].map(x => x && [x.t, x.min]);
        gs.lights.removeLight(N);
        return out;
    });
    t.eq('呼吸倍率：起點 1、半週期 min、一週期回 1', JSON.stringify(b.math), JSON.stringify([1, 0.6, 1]));
    t.eq('Tiled 平的屬性 breath_t／breath_min', JSON.stringify(b.tiled), JSON.stringify([{t: 3, min: 0.5}, null, {t: 1}]));
    t.eq('setBreath：存 t／min／base、起點 0～1、兩盞不同', JSON.stringify(b.data), JSON.stringify([0.5, 0.2, 2, true, true]));
    t.check('pipeline 每幀算亮度：在 base×min～base 之間來回', b.range[0] >= 0.39 && b.range[0] < 1 && b.range[1] <= 2.01 && b.range[1] > 1.4, JSON.stringify(b.range));
    t.eq('改基準 0（藏起來）：起點不變、亮度 0', JSON.stringify(b.hidden), JSON.stringify([true, 0]));
    t.eq('拿掉呼吸：回到基準', JSON.stringify(b.off), JSON.stringify([null, 1.5]));
    t.eq('池子拿回來的燈：setBreath(null) 清掉', JSON.stringify(b.pool), JSON.stringify([null, 1]));
    t.eq('夾範圍：t 最少 0.1、min 0～1；沒有 t＝不呼吸', JSON.stringify(b.clamp), JSON.stringify([[0.1, 1], null]));
});
