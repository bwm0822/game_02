// 粒子特效核心（src/core/particle.js）：貼圖來源、友善寫法、burst／stream 生命週期、duration 優先順序、follow／local、目標消失自動停、區域放大
import {run} from './harness.mjs'

run('粒子特效', async t => {
    await t.waitFor(d => d?.game.scene.isActive('MainMenu'), {what:'主選單'});
    const r = await t.eval(async (d) => {
        const P = await import('/src/core/particle.js');
        const scene = d.game.scene.getScene('MainMenu');
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const out = {};

        out.db = [!!d.DB.particle('ember'), d.DB.particle('nope') === undefined];

        out.tex = [P.particleTexture(scene, 'p-soft').key, scene.textures.exists('p-soft'),
                   JSON.stringify(P.particleTexture(scene, 'arrow')),
                   P.particleTexture(scene, '🔥').key, scene.textures.exists('emoji:🔥')];

        const cfg = P.emitterConfig({img: 'p-dot', mode: 'burst', count: 3, tint: {start: '#ff6600', end: '#000010'}, color: ['#ffffff', '#ff0000'], blendMode: 'add',
                                     emitZone: {type: 'random', source: {w: 10, h: 4}}, speed: 5});
        out.cfg = [cfg.tint.start, cfg.tint.end, JSON.stringify(cfg.color), cfg.blendMode,
                   cfg.emitZone.source instanceof Phaser.Geom.Rectangle, cfg.emitZone.source.x, 'img' in cfg || 'mode' in cfg || 'count' in cfg, cfg.speed];
        out.emojiCfg = 'tint' in P.emitterConfig({tint: '#fff'}, {emoji: true});

        out.empty = P.playParticle(scene, null);

        const burst = P.playParticle(scene, {img: 'p-dot', mode: 'burst', count: 7, lifespan: 150, speed: 20}, {x: 100, y: 100});
        out.burst = [burst.alive, burst.emitter.depth];
        await Promise.race([burst.done, sleep(1500)]);
        out.burst.push(burst.emitter === null);

        const s1 = P.playParticle(scene, {img: 'p-dot', duration: 200, lifespan: 100, frequency: 20}, {x: 100, y: 100});
        await sleep(100);
        out.timed = [s1.emitter.emitting];
        await Promise.race([s1.done, sleep(1500)]);
        out.timed.push(s1.emitter === null);

        const s2 = P.playParticle(scene, {img: 'p-dot', duration: 5000, lifespan: 100, frequency: 20}, {x: 100, y: 100, duration: 150});
        await Promise.race([s2.done, sleep(1500)]);
        out.override = s2.emitter === null;

        const s3 = P.playParticle(scene, {img: 'p-dot', lifespan: 300, frequency: 20}, {x: 100, y: 100});
        await sleep(400);
        out.endless = [s3.emitter.emitting];
        s3.stop();
        out.endless.push(s3.emitter?.emitting, s3.alive > 0);
        await Promise.race([s3.done, sleep(1500)]);
        out.endless.push(s3.emitter === null);

        const s4 = P.playParticle(scene, {img: 'p-dot', lifespan: 300, frequency: 20}, {x: 100, y: 100});
        await sleep(100);
        s4.stop(true);
        out.kill = s4.emitter === null;

        const box = scene.add.container(200, 150);
        const f = P.playParticle(scene, {img: 'p-dot', lifespan: 200, frequency: 20, x: 3, y: -5}, {target: box, oy: -2});
        const born = () => {const p = f.emitter.alive.at(-1); return [Math.round(p.x), Math.round(p.y)];};
        await sleep(60);
        out.follow = [...born(), f.emitter.parentContainer === null];
        box.x = 260;
        await sleep(60);
        out.follow.push(born()[0]);
        box.destroy();
        await sleep(50);
        out.follow.push(f.emitter?.emitting);
        await Promise.race([f.done, sleep(1500)]);
        out.follow.push(f.emitter === null);

        const box2 = scene.add.container(200, 150);
        box2.setDepth(10);
        const u = P.playParticle(scene, {img: 'p-dot', lifespan: 200, frequency: 20, depth: 'under'}, {target: box2});
        out.under = [u.emitter.depth];
        u.stop(true);

        const box3 = scene.add.container(200, 150);
        const l = P.playParticle(scene, {img: 'p-dot', lifespan: 200, frequency: 20, local: true, y: -10}, {target: box3});
        out.local = [l.emitter.parentContainer === box3, l.emitter.x, l.emitter.y];
        box3.destroy();
        await Promise.race([l.done, sleep(500)]);
        out.local.push(l.emitter === null);

        const a = P.playParticle(scene, {img: 'p-dot', lifespan: 200, frequency: 50, quantity: 2}, {x: 100, y: 100, area: {w: 96, h: 32, cells: 3}});
        out.area = [a.emitter.quantity.propertyValue ?? a.emitter.quantity, a.emitter.emitZones[0]?.source.width];
        a.stop(true);
        const ab = P.playParticle(scene, {img: 'p-dot', mode: 'burst', count: 4, lifespan: 300}, {x: 100, y: 100, area: {w: 96, h: 32, cells: 3}});
        out.area.push(ab.alive);
        ab.stop(true);

        const e = P.playParticle(scene, {img: '✨', mode: 'burst', count: 2, lifespan: 100, tint: '#ff0000'}, {x: 100, y: 100});
        out.emoji = e.emitter.texture.key;
        e.stop(true);

        const all = Object.entries(d.DB._particleDB).map(([id, def]) => [id, P.playParticle(scene, def, {x: 300, y: 200})]);
        await sleep(300);
        out.all = all.filter(([, h]) => !(h.alive > 0 || h.emitter === null)).map(([id]) => id);
        all.forEach(([, h]) => h.stop(true));
        return out;
    });

    t.eq('DB.particle 查得到、查不到回 undefined', JSON.stringify(r.db), JSON.stringify([true, true]));
    t.eq('貼圖：內建形狀第一次用到才畫、texture key 原樣、其他字畫成 emoji 快取',
        JSON.stringify(r.tex), JSON.stringify(['p-soft', true, JSON.stringify({key: 'arrow'}), 'emoji:🔥', true]));
    t.eq('友善寫法：#hex、blendMode 字串、emitZone {w,h} 換 Rectangle 置中、自己的欄位不傳給 Phaser',
        JSON.stringify(r.cfg), JSON.stringify([0xff6600, 0x000010, JSON.stringify([0xffffff, 0xff0000]), 1, true, -5, false, 5]));
    t.eq('emoji 不吃 tint', r.emojiCfg, false);
    t.eq('def 是空的不播', r.empty, null);
    t.eq('burst：一次噴 count 顆、預設最上層、噴完自動銷毀', JSON.stringify(r.burst), JSON.stringify([7, Infinity, true]));
    t.eq('stream＋條目 duration：時間到停、飄完銷毀', JSON.stringify(r.timed), JSON.stringify([true, true]));
    t.check('呼叫端的 duration 蓋掉條目的', r.override);
    t.eq('stream 沒 duration：一直噴；stop() 停止發射、剩下的飄完才銷毀', JSON.stringify(r.endless), JSON.stringify([true, false, true, true]));
    t.check('stop(true) 立刻清掉', r.kill);
    t.eq('world＋follow：偏移＝def.x/y＋opts、跟著目標、目標銷毀自動 stop、飄完銷毀',
        JSON.stringify(r.follow), JSON.stringify([203, 143, true, 263, false, true]));
    t.eq('depth under：目標深度 -0.5', JSON.stringify(r.under), JSON.stringify([9.5]));
    t.eq('local：加進目標 container、座標是本地的、container 銷毀一起收掉', JSON.stringify(r.local), JSON.stringify([true, 0, -10, true]));
    t.eq('area：quantity／count 乘格數、發射範圍＝w×h', JSON.stringify(r.area), JSON.stringify([6, 96, 12]));
    t.eq('emoji 粒子', r.emoji, 'emoji:✨');
    t.eq('particle.json 每一筆都噴得出來（沒噴出粒子的列出來）', JSON.stringify(r.all), '[]');

    // 技能：cast／travel／fx 的 particle（固定資料，實際 ability.json 常調）
    await t.newGame();
    const g = await t.eval(async (d) => {
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const p = d.GM.player, scene = p.scene, out = {};
        const target = d.objs().find(o => o !== p && o.takeDamage && o.isAlive !== false);
        out.hasTarget = !!target;
        if (!target) return out;
        const made = [], icons = [];
        const add = scene.add.particles;
        scene.add.particles = function (x, y, key, cfg) {
            const em = add.call(this, x, y, key, cfg);
            made.push({key, burst: cfg.emitting === false, em});
            return em;
        };
        const fx = p.fx, tfx = target.fx;
        p.fx = (c) => {icons.push(['caster', c.icon]); return fx(c);};
        target.fx = (c) => {icons.push(['target', c.icon]); return tfx(c);};
        Object.assign(d.DB._particleDB, {
            't-cast': {img: 'p-dot', duration: 200, lifespan: 100, frequency: 20},
            't-trail': {img: 'p-soft', lifespan: 150, frequency: 20},
            't-hit': {img: 'p-spark', mode: 'burst', count: 5, lifespan: 150, speed: 30},
        });
        const ab = {tag: 'atk', icon: '🔥', cast: {img: '', particle: 't-cast'}, travel: {type: 'spell', img: '🔥', size: 25, deg: -90, particle: 't-trail'},
                    fx: {particle: 't-hit'}, hits: [{elm: 'fire', pow: 0, flat: 0}]};
        let trailDuring = null;
        const watch = setInterval(() => {const t = made.find(m => m.key === 'p-soft'); if (t && trailDuring === null && t.em.active) trailDuring = !!t.em.follow;}, 10);
        await p.attack([target], ab);
        clearInterval(watch);
        out.made = made.map(m => `${m.key}${m.burst ? ':burst' : ''}`);
        out.trailFollow = trailDuring;
        out.trailStopped = made.find(m => m.key === 'p-soft')?.em.emitting;
        out.icons = icons.map(([w, i]) => `${w}:${i}`);
        await sleep(600);
        out.cleaned = made.every(m => !m.em.active);
        scene.add.particles = add;
        p.fx = fx; target.fx = tfx;
        return out;
    });
    t.check('地圖上有可以打的對象', g.hasTarget);
    t.eq('技能三段：施法者噴 cast、投射物拖尾、命中一次噴', JSON.stringify(g.made), JSON.stringify(['p-dot', 'p-soft', 'p-spark:burst']));
    t.check('拖尾跟著投射物（world＋follow）', g.trailFollow);
    t.eq('命中時拖尾停止發射', g.trailStopped, false);
    t.eq('cast.img 空字串不跳 icon；fx 沒寫 img 用技能 icon', JSON.stringify(g.icons), JSON.stringify(['target:🔥']));
    t.check('播完全部清掉', g.cleaned);
});
