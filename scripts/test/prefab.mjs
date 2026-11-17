// prefab（docs/prefab.md）：ItemView 照 prefab.json 建零件、錨點／占地方塊、狀態切換（png／粒子／光源）、存讀檔
import {run} from './harness.mjs'

run('prefab', async t => {
    await t.newGame();

    const r = await t.eval(async d => {
        const gs = d.game.scene.getScene('GameScene');
        const {default: Item} = await import('/src/items/item.js');
        d.DB._prefabDB.t_forge = {
            look: 'off',
            thumb: {x: -20, y: -40, w: 40, h: 40},
            grid: {x: -16, y: -16, w: 32, h: 16},
            parts: [
                {img: 'Barrel'},
                {img: 'Crate', y: -20, look: 'on', fx: 'burn', depth: 1},
                {img: 'Crate', y: -20, look: 'off', sx: 0.5, sy: 0.5},
                {particle: 'campfire', y: -30, look: 'on'},
                {light: {r: 100, color: '#ff8800'}, y: -16, look: 'on'},
            ],
        };
        const p = d.GM.player;
        const make = () => {
            const go = new Item(gs, p.x + 96, p.y);
            go.uid = 987654;
            go.bb.prefab = 't_forge';
            go.init_prefab();
            return go;
        };
        const vis = go => go.view._shape.list.map(h => h.visible);
        const nLights = () => gs.lights.lights.length;
        const L0 = nLights();

        const go = make();
        const out = {};
        out.anchorY = go.y - p.y;
        out.wid = [go.view.wid, go.view.hei];
        out.grid = [go.view.gl, go.view.gt, go.view.gw, go.view.gh];
        out.count = go.view._shape.list.length;
        out.off = vis(go);
        out.offLights = nLights() - L0;
        out.offEm = go.view._parts.filter(e => e.em).length;
        out.look0 = go.getLook();

        go.setLook('on');
        out.on = vis(go);
        out.onLights = nLights() - L0;
        out.onEm = go.view._parts.filter(e => e.em).length;
        out.lightPos = (() => {const l = go.view._parts.find(e => e.light).light; return [l.x - go.x, l.y - go.y];})();

        go.save();
        out.saved = d.Record.getByUid(gs._data.map, 987654);
        go.emit('remove');
        out.afterRemoveLights = nLights() - L0;
        d.Record.game.scenes[gs._data.map].prefab[987654] = {look: 'on'};
        const go2 = make();
        out.reload = vis(go2);
        out.reloadLights = nLights() - L0;
        go2.setLook('nope');
        out.ending = vis(go2);
        await new Promise(res => setTimeout(res, 600));
        out.bad = vis(go2);
        out.badLights = nLights() - L0;
        go2.emit('remove');
        delete d.Record.game.scenes[gs._data.map].prefab[987654];
        delete d.DB._prefabDB.t_forge;
        return out;
    });

    t.eq('錨點＝縮圖中心往下 20（thumb.y＋h/2）', r.anchorY, 20);
    t.eq('view 大小＝縮圖', JSON.stringify(r.wid), '[40,40]');
    t.eq('grid 方塊換成 View 欄位（相對縮圖左上）', JSON.stringify(r.grid), '[4,24,32,16]');
    t.eq('三張 png 零件', r.count, 3);
    t.eq('預設 look＝off', r.look0, 'off');
    t.eq('off：底座＋小箱子，火焰藏', JSON.stringify(r.off), '[true,true,false]');
    t.check('off：沒光源、沒粒子', r.offLights === 0 && r.offEm === 0, JSON.stringify(r));
    t.eq('on：底座＋火焰，小箱子藏', JSON.stringify(r.on), '[true,false,true]');
    t.check('on：一盞光、一個粒子', r.onLights === 1 && r.onEm === 1, JSON.stringify(r));
    t.eq('光源在錨點＋(0,-16)', JSON.stringify(r.lightPos), '[0,-16]');
    t.eq('存檔記 look', JSON.stringify(r.saved), '{"look":"on"}');
    t.eq('移除後光源拿掉', r.afterRemoveLights, 0);
    t.eq('讀檔還原 on', JSON.stringify(r.reload), '[true,false,true]');
    t.eq('讀檔 on 有光', r.reloadLights, 1);
    t.eq('切走時火焰先播 fx 的 end（還看得到）', JSON.stringify(r.ending), '[true,false,true]');
    t.eq('不存在的狀態：end 播完只剩沒寫 look 的', JSON.stringify(r.bad), '[true,false,false]');
    t.eq('不存在的狀態：光源關掉', r.badLights, 0);

    // acts／defAct／動態選單按鈕／燈交給 prefab
    const a = await t.eval(async d => {
        const gs = d.game.scene.getScene('GameScene');
        const {default: Item} = await import('/src/items/item.js');
        const {default: Lamp} = await import('/src/items/lamp.js');
        const {default: UiOption} = await import('/src/ui/uioption.js');
        d.DB._prefabDB.t_brazier = {
            look: 'off', acts: {t_fan: 'on', t_douse: 'off'}, defAct: 't_fan',
            parts: [{img: 'Barrel'}, {light: {r: 80}, look: 'on'}],
        };
        d.DB._prefabDB.t_lamp = {
            look: 'off', acts: {turn_on: 'on', turn_off: 'off'},
            parts: [{img: 'Barrel'}, {light: {r: 80}, look: 'on'}],
        };
        const p = d.GM.player;
        const nLights = () => gs.lights.lights.length;
        const L0 = nLights();
        const out = {};

        const go = new Item(gs, p.x + 96, p.y);
        go.uid = 987655;
        go.bb.prefab = 't_brazier';
        go.init_prefab();
        const acts = () => Object.fromEntries(Object.entries(go.acts).map(([k, v]) => [k, v === d.GM.EN ? 'en' : v === d.GM.HIDE ? 'hide' : v]));
        out.interactive = !!go.view._zone;
        out.acts0 = acts();
        out.def0 = go.act;
        await go.aEmit('t_fan', p);
        out.look1 = go.getLook();
        out.acts1 = acts();
        out.def1 = go.act ?? null;
        out.lights1 = nLights() - L0;

        UiOption.show(0, 0, go.acts, go);
        const it = UiOption.instance._items;
        out.btn = {douse: !!it.t_douse?.visible, fan: it.t_fan ? it.t_fan.visible : 'none'};
        UiOption.instance.close();
        go.emit('remove');

        const lamp = new Lamp(gs, p.x + 160, p.y);
        lamp.uid = 987656;
        lamp.bb.prefab = 't_lamp';
        lamp.bb.lit = true;
        lamp.init_prefab();
        out.lampLights0 = nLights() - L0;
        out.lampActs0 = Object.fromEntries(Object.entries(lamp.acts));
        await lamp.aEmit('turn_on', p);
        out.lampLights1 = nLights() - L0;
        out.lampLook = lamp.getLook();
        lamp.emit('remove');

        for (const id of [987655, 987656]) delete d.Record.game.scenes?.[gs._data.map]?.prefab?.[id];
        delete d.DB._prefabDB.t_brazier;
        delete d.DB._prefabDB.t_lamp;
        return out;
    });
    t.check('有 acts 的 item 變成可互動', a.interactive);
    t.eq('off：只出 t_fan', JSON.stringify(a.acts0), '{"t_fan":"en","t_douse":"hide"}');
    t.eq('左鍵＝defAct', a.def0, 't_fan');
    t.eq('觸發 t_fan → on', a.look1, 'on');
    t.eq('on：t_fan 藏、t_douse 出', JSON.stringify(a.acts1), '{"t_fan":"hide","t_douse":"en"}');
    t.eq('defAct 藏起來時左鍵沒有預設（acts 不進 ORDER）', a.def1, null);
    t.eq('on：光源亮', a.lights1, 1);
    t.check('選單：動態建 t_douse 按鈕並顯示、藏著的 t_fan 不顯示（還沒用到就不建）', a.btn.douse === true && a.btn.fan !== true, JSON.stringify(a.btn));
    t.eq('燈有 prefab：com_lamp 不自己點燈（lit 被忽略）', a.lampLights0, 0);
    t.eq('燈有 prefab：開關照 prefab 的 acts', a.lampActs0.turn_on !== undefined && a.lampActs0.turn_off !== undefined, true);
    t.eq('燈 turn_on → prefab on、只有一盞光', `${a.lampLook}/${a.lampLights1}`, 'on/1');
});
