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

    // 擾動：light.flicker，pipeline 上傳前換成擾動後的亮度／半徑／位置、上傳完換回來（資料不動）；每盞自己的種子；池子拿回來的燈清掉
    const f = await t.eval(async d => {
        const gs = d.game.scene.getScene('GameScene');
        const {setFlicker, flickerAt, flickerOf, noise, FLICKER_DEF} = await import('/src/core/spotlight.js');
        const frame = () => new Promise(res => requestAnimationFrame(res));
        const out = {};
        // 雜訊平滑、0～1：相鄰取樣差很小
        const ns = Array.from({length: 400}, (_, k) => noise(k / 40));
        out.noise = [Math.min(...ns) >= 0, Math.max(...ns) <= 1, Math.max(...ns.slice(1).map((v, k) => Math.abs(v - ns[k]))) < 0.1];
        const fa = Array.from({length: 200}, (_, k) => flickerAt({i: 0.5, r: 0.2, xy: 3, hz: 8, seed: 1}, k / 50));
        out.at = [Math.min(...fa.map(v => v.i)) >= 0.5, Math.max(...fa.map(v => v.i)) <= 1, fa.every(v => Math.abs((1 - v.r) / 0.2 - (1 - v.i) / 0.5) < 1e-9),
                  fa.every(v => Math.abs(v.x) <= 3 && Math.abs(v.y) <= 3), fa.some(v => v.x !== fa[0].x)];
        out.tiled = [flickerOf({flicker_hz: 12}), flickerOf({}), flickerOf({flicker: {i: 0.1}})];
        out.def = FLICKER_DEF;
        // 抓這盞燈上傳的 intensity／radius（基準 7／333，跟場上其他燈分得開）
        const p = d.GM.player, pipe = d.game.renderer.pipelines.get('Light2D');
        const L = setFlicker(gs.lights.addLight(p.x, p.y, 333, 0xffffff, 7), {i: 0.5, r: 0.2, xy: 3, hz: 20});
        const M = setFlicker(gs.lights.addLight(p.x, p.y, 100, 0xffffff, 1), {});
        out.data = [L.flicker.i, L.flicker.r, L.flicker.xy, L.flicker.hz, L.flicker.seed !== M.flicker.seed, JSON.stringify([M.flicker.i, M.flicker.r, M.flicker.xy, M.flicker.hz])];
        const iv = [], rv = [], orig = pipe.set1f;
        pipe.set1f = function (n, v, ...a) {
            if (/intensity$/.test(n) && v >= 3.4 && v <= 7.01) iv.push(v);
            if (/radius$/.test(n) && v >= 266 && v <= 333.01) rv.push(v);
            return orig.call(this, n, v, ...a);
        };
        const t0 = performance.now();
        while (performance.now() - t0 < 600) await frame();
        pipe.set1f = orig;
        out.upload = [iv.length > 10, new Set(iv.map(v => v.toFixed(3))).size > 3, Math.min(...iv) >= 3.5 - 1e-6, rv.length > 10, Math.min(...rv) >= 266.4 - 1e-6];
        // 畫完資料沒被動到：位置、半徑、亮度都是原本的
        out.restored = [L.x === p.x, L.y === p.y, L.radius === 333, L.intensity === 7];
        // 再叫一次：種子不變；null＝清掉
        const seed = L.flicker.seed;
        setFlicker(L, {i: 0.1});
        out.reseed = [L.flicker.seed === seed, L.flicker.i];
        setFlicker(L, null);
        out.off = L.flicker;
        gs.lights.removeLight(L);
        gs.lights.removeLight(M);
        const N = setFlicker(gs.lights.addLight(0, 0, 100, 0xffffff, 1), null);
        out.pool = N.flicker;
        // 夾範圍：i／r 0～1、xy ≥0、hz 0.1～60，亂填用預設
        out.clamp = (o => [o.i, o.r, o.xy, o.hz])(setFlicker(N, {i: 3, r: -1, xy: -5, hz: 0, }).flicker);
        out.bad = (o => [o.i, o.hz])(setFlicker(N, {i: 'x', hz: null}).flicker);
        gs.lights.removeLight(N);
        return out;
    });
    t.eq('雜訊 0～1、平滑', JSON.stringify(f.noise), '[true,true,true]');
    t.eq('flickerAt：亮度 1−i～1、半徑跟亮度同一條雜訊、位置 ±xy、會變', JSON.stringify(f.at), '[true,true,true,true,true]');
    t.eq('Tiled 平的屬性 flicker_*：寫了任一個就開', JSON.stringify(f.tiled), JSON.stringify([{hz: 12}, null, {i: 0.1}]));
    t.eq('預設 {i:0.3, r:0.1, xy:2, hz:8}', JSON.stringify(f.def), JSON.stringify({i: 0.3, r: 0.1, xy: 2, hz: 8}));
    t.eq('setFlicker：存數字、兩盞種子不同、空的用預設', JSON.stringify(f.data), JSON.stringify([0.5, 0.2, 3, 20, true, '[0.3,0.1,2,8]']));
    t.eq('pipeline 上傳擾動後的亮度／半徑（會變、在範圍內）', JSON.stringify(f.upload), '[true,true,true,true,true]');
    t.eq('畫完換回來：資料位置／半徑／亮度不動', JSON.stringify(f.restored), '[true,true,true,true]');
    t.eq('再叫一次：種子不變', JSON.stringify(f.reseed), '[true,0.1]');
    t.eq('setFlicker(null) 清掉', f.off, null);
    t.eq('池子拿回來的燈：setFlicker(null) 清掉', f.pool, null);
    t.eq('夾範圍', JSON.stringify(f.clamp), JSON.stringify([1, 0, 0, 0.1]));
    t.eq('亂填用預設', JSON.stringify(f.bad), JSON.stringify([0.3, 8]));
});
