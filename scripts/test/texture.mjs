// 圖片工具（tools/texture）：用 window.__tx 直接呼叫，OPFS 當假的專案根目錄
import {run} from './harness.mjs'

run('texture', async t => {
    const base = t.page.url();
    await t.page.goto(new URL('tools/texture/', base).href);
    await t.page.waitForFunction(() => window.__tx);

    const r = await t.page.evaluate(async () => {
        const tx = window.__tx, S = tx.S, out = {}, $ = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const dlg = async () => {for (let i = 0; i < 200 && !$('dlgAsk').open; i++) await sleep(20); return $('dlgAsk').open;};

        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, path) => {let d = parent; for (const n of path.split('/')) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (path, data) => {
            const i = path.lastIndexOf('/');
            const w = await (await (await dir(proj, path.slice(0, i))).getFileHandle(path.slice(i + 1), {create: true})).createWritable();
            await w.write(data); await w.close();
        };
        const exists = async (path) => {
            const segs = path.split('/');
            try {let d = proj; for (const s of segs.slice(0, -1)) d = await d.getDirectoryHandle(s); await d.getFileHandle(segs.at(-1)); return true;}
            catch {return false;}
        };
        const dirExists = async (path) => {try {let d = proj; for (const s of path.split('/')) d = await d.getDirectoryHandle(s); return true;} catch {return false;}};
        const cv = Object.assign(document.createElement('canvas'), {width: 4, height: 4});
        const png = await new Promise(res => cv.toBlob(res));
        const proj = await dir(opfs, 'game');
        const T = 'public/assets/textures';
        for (const p of ['equips/a', 'equips/b', 'icons/sh', 'maps/tiles/t', 'props/c', 'props/d', 'props/f', '.tbd/x/e', '.tbd/y/c', 'minimap/m', 'top'])
            await write(`${T}/${p}.png`, png);
        await write(`${T}/icons/sh_sheet.json`, '{"w": 2}');
        // b、d 只出現在不是放圖的地方（同名字串），要算未使用
        await write('public/assets/json/item.json', JSON.stringify({it1: {icon: 'a', grp: 'b'}, it2: {equip: {sprite: 'e'}}, b: {}}));
        await write('public/assets/json/textures.json', JSON.stringify({image: {b: 'x'}}));
        await write('public/assets/maps/m/map1.json', JSON.stringify({layers: [{objects: [{type: 'b', name: 'd', properties: [{name: 'door', type: 'string', value: 'sh:3'}]}]}]}));
        await write('public/assets/tilesets/tiles.tsj', JSON.stringify({name: 't', image: '../textures/maps/tiles/t.png'}));
        await write('public/assets/templates/x.tj', JSON.stringify({object: {properties: [{name: 'top', value: 'top'}]}}));
        await write('src/ui/x.js', "this.add.image(0, 0, 'c');\nconst tag = 'b', k = 'doors:3';\n// sprite 'b'\n");
        await write('src/old/y.js', "add.image('d');\n");
        await write('public/assets/json/fx.json', JSON.stringify({burn: {img: 'f', cell: {align: 'd'}}}));

        await tx.setRoot(proj);
        const paths = S.tex.map(e => e.path.slice('textures/'.length));
        out.list = paths.join(',');
        out.metas = S.tex.find(e => e.key === 'sh').metas.join(',');
        out.unused = S.tex.filter(tx.isUnused).map(e => e.key).join(',');
        out.bad = S.tex.filter(tx.isBad).map(e => e.path).join(',');
        const ra = tx.refsOf(S.tex.find(e => e.key === 'a'));
        out.goA = JSON.stringify(ra.map(x => x.go));
        out.goF = JSON.stringify(tx.refsOf(S.tex.find(e => e.key === 'f'))[0]?.go);
        out.refT = tx.refsOf(S.tex.find(e => e.key === 't')).map(x => x.text).join('|');
        const nodes = () => [...document.querySelectorAll('#list .node')].map(n => n.dataset.node.replace('textures/', '')).join(',');
        out.nodes = nodes();
        // 收合：預設摺起來，點箭頭展開／摺（不換選取），點名字＝選取＋展開，Alt＋點全部
        const arrowOf = (d) => document.querySelector(`#list .node[data-node="textures/${d}"] .arrow`);
        const nodeOf = (d) => document.querySelector(`#list .node[data-node="textures/${d}"]`);
        arrowOf('maps').click();
        out.unfold = [nodes(), S.node, arrowOf('maps').textContent, $('list').textContent.includes('null')];
        arrowOf('maps').click();
        out.fold = [nodes() === out.nodes, arrowOf('maps').textContent];
        nodeOf('.tbd').click();
        out.nameOpen = [nodes(), S.node];
        nodeOf('.tbd').click();
        out.nameKeep = arrowOf('.tbd').textContent;
        arrowOf('maps').dispatchEvent(new MouseEvent('click', {altKey: true, bubbles: true}));
        out.unfoldAll = nodes();
        arrowOf('maps').dispatchEvent(new MouseEvent('click', {altKey: true, bubbles: true}));
        out.foldAll = nodes() === out.nodes;

        // 選取：點、Ctrl 加、Shift 範圍
        S.node = 'textures/props'; tx.render();
        const ev = (o = {}) => ({shiftKey: false, ctrlKey: false, ...o});
        tx.click(ev(), 'textures/props/c.png');
        tx.click(ev({shiftKey: true}), 'textures/props/f.png');
        out.shift = [...S.sel].join(',');
        tx.click(ev({ctrlKey: true}), 'textures/props/d.png');
        out.ctrl = [...S.sel].join(',');
        out.btns = ['btnTbd', 'btnBack', 'btnDel'].map(id => $(id).disabled);

        // 搬到 tbd：沒被引用的不問；sheet 的 _sheet.json 一起搬
        await tx.toTbd([S.tex.find(e => e.key === 'b')]);
        let p = tx.toTbd([S.tex.find(e => e.key === 'sh')]);
        if (await dlg()) $('dlgAsk').close('ok');
        await p;
        out.moved = [await exists(`${T}/.tbd/equips/b.png`), await exists(`${T}/equips/b.png`), await exists(`${T}/.tbd/icons/sh.png`), await exists(`${T}/.tbd/icons/sh_sheet.json`), await exists(`${T}/icons/sh_sheet.json`)];
        out.shBad = tx.isBad(S.tex.find(e => e.key === 'sh'));
        // 被引用的要確認，取消就不搬
        p = tx.toTbd([S.tex.find(e => e.key === 'a')]);
        out.askA = await dlg() && $('dlgAsk').textContent.includes('item.json：it1.icon');
        $('dlgAsk').close('cancel'); await p;
        out.keptA = await exists(`${T}/equips/a.png`);
        // 根目錄的圖也能搬
        p = tx.toTbd([S.tex.find(e => e.key === 'top')]);
        if (await dlg()) $('dlgAsk').close('ok');
        await p;
        out.top = await exists(`${T}/.tbd/top.png`);

        // 搬回原位：tbd 的空資料夾一起清掉；跟外面撞名的不搬
        await tx.back([S.tex.find(e => e.path === 'textures/.tbd/equips/b.png'), S.tex.find(e => e.path === 'textures/.tbd/y/c.png'), S.tex.find(e => e.path === 'textures/.tbd/top.png')]);
        out.back = [await exists(`${T}/equips/b.png`), await dirExists(`${T}/.tbd/equips`), await exists(`${T}/.tbd/y/c.png`), await exists(`${T}/top.png`)];
        out.backMsg = $('status').textContent;
        // 原位已經有同名檔也不搬
        await write(`${T}/icons/sh.png`, png);
        await tx.relist();
        await tx.back([S.tex.find(e => e.path === 'textures/.tbd/icons/sh.png')]);
        out.backExists = [await exists(`${T}/.tbd/icons/sh.png`), await exists(`${T}/.tbd/icons/sh_sheet.json`)];

        // 刪除：一定確認
        p = tx.remove([S.tex.find(e => e.path === 'textures/.tbd/x/e.png')]);
        out.askDel = await dlg() && $('dlgAsk').textContent.includes('不能 undo') && $('dlgAsk').textContent.includes('it2.equip.sprite');
        $('dlgAsk').close('ok'); await p;
        out.deleted = [await exists(`${T}/.tbd/x/e.png`), await dirExists(`${T}/.tbd/x`), await dirExists(`${T}/.tbd`)];
        return out;
    });

    t.eq('列出 textures/（不含 minimap/）', r.list, '.tbd/x/e.png,.tbd/y/c.png,equips/a.png,equips/b.png,icons/sh.png,maps/tiles/t.png,props/c.png,props/d.png,props/f.png,top.png');
    t.eq('sheet 帶著 _sheet.json', r.metas, 'sh_sheet.json');
    t.eq('未使用：src 註解、src/old、textures.json、物件 key、不是放圖的欄位／src 行都不算', r.unused, 'b,d');
    t.eq('tbd 裡還被引用的標紅', r.bad, 'textures/.tbd/x/e.png,textures/.tbd/y/c.png');
    t.eq('item.json 的引用 ↗ 跳道具分頁', r.goA, JSON.stringify([['item', ['it1']]]));
    t.eq('fx.json 的引用 ↗ 跳特效分頁', r.goF, JSON.stringify(['fx', ['burn']]));
    t.eq('tsj 的 image 用路徑引用', r.refT, 'tilesets/tiles.tsj：image');
    t.eq('左欄：未使用、資料夾樹（預設摺起來）、tbd 最後', r.nodes, '#unused,equips,icons,maps,props,.tbd');
    t.eq('點箭頭展開子資料夾、不換選取', JSON.stringify(r.unfold), JSON.stringify(['#unused,equips,icons,maps,maps/tiles,props,.tbd', '#unused', '▾', false]));
    t.eq('再點箭頭摺回去', JSON.stringify(r.fold), JSON.stringify([true, '▸']));
    t.eq('點名字＝選取＋展開', JSON.stringify(r.nameOpen), JSON.stringify(['#unused,equips,icons,maps,props,.tbd,.tbd/x,.tbd/y', 'textures/.tbd']));
    t.eq('再點名字不會摺起來', r.nameKeep, '▾');
    t.eq('Alt＋點全部展開', r.unfoldAll, '#unused,equips,icons,maps,maps/tiles,props,.tbd,.tbd/x,.tbd/y');
    t.check('Alt＋點全部摺', r.foldAll);
    t.eq('Shift 範圍選', r.shift, 'textures/props/c.png,textures/props/d.png,textures/props/f.png');
    t.eq('Ctrl 取消一張', r.ctrl, 'textures/props/c.png,textures/props/f.png');
    t.eq('一般資料夾只能搬到 tbd', JSON.stringify(r.btns), JSON.stringify([false, true, true]));
    t.eq('搬到 tbd：保留相對路徑、_sheet.json 一起搬', JSON.stringify(r.moved), JSON.stringify([true, false, true, true, false]));
    t.check('搬進 tbd 的還被引用就標紅', r.shBad);
    t.check('被引用的搬之前列出引用', r.askA);
    t.check('取消就不搬', r.keptA);
    t.check('textures/ 根目錄的圖也能搬', r.top);
    t.eq('搬回：清掉空的 tbd 資料夾、撞名的不搬', JSON.stringify(r.back), JSON.stringify([true, false, true, true]));
    t.check('撞名寫在狀態列', r.backMsg.includes('撞名'), r.backMsg);
    t.eq('原位已有同名檔就不搬（_sheet.json 也留著）', JSON.stringify(r.backExists), JSON.stringify([true, true]));
    t.check('刪除要確認、提醒不能 undo、列出引用', r.askDel);
    t.eq('刪除：檔案跟空資料夾都清掉、tbd 本身留著', JSON.stringify(r.deleted), JSON.stringify([false, false, true]));

    // 殼：分頁接線、↗ 跳到道具分頁
    await t.page.goto(new URL('tools/#texture', base).href);
    await t.page.waitForFunction(() => window.__tools);
    const s = await t.page.evaluate(async () => {
        const T = window.__tools, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f) => {for (let i = 0; i < 250 && !f(); i++) await sleep(20); return f();};
        const win = (tab) => T.S.frames[tab]?.contentWindow;
        const proj = await (await navigator.storage.getDirectory()).getDirectoryHandle('game');
        await T.setProject(proj).catch(e => {out.err = e.message;});
        out.loaded = !!await until(() => win('texture')?.__tx?.S.refs);
        const tx = win('texture').__tx;
        tx.click({}, 'textures/equips/a.png');
        win('texture').document.querySelector('#detail a.go').click();
        out.toItem = !!await until(() => location.hash === '#item');
        return out;
    });
    t.check('殼的圖片分頁拿到專案資料夾、掃完', s.loaded, s.err);
    t.check('引用 ↗ 跳到道具分頁', s.toItem);
});
