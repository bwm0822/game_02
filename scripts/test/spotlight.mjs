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
        const amb = gs.lights.ambientColor.color;
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
        gs.lights.removeLight(L);
        saved.forEach(([l, i]) => l.intensity = i);
        gs.lights.setAmbientColor(amb);
        return {point, right, left, up};
    });
    t.check('點光源左右都亮', r.point.left > 0 && r.point.right > 0, JSON.stringify(r.point));
    t.check('朝右(dir 0)：右亮、左暗', r.right.right > 0 && r.right.left === 0, JSON.stringify(r.right));
    t.check('朝左(dir 180)：左亮、右暗', r.left.left > 0 && r.left.right === 0, JSON.stringify(r.left));
    t.check('朝上(dir 270)：上亮、左右暗', r.up.up > 0 && r.up.left === 0 && r.up.right === 0, JSON.stringify(r.up));
});
