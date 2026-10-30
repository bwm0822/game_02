// 設定分頁（tools/settings）＋ tools/settings.json：OPFS 當專案根目錄丟給殼，驗證紙娃娃舊 localStorage 搬家、只存改過的值、空白回內建、undo、跨分頁廣播
import {run} from './harness.mjs'

run('settings', async t => {
    await t.page.goto(new URL('tools/#settings', t.page.url()).href);
    await t.page.waitForFunction(() => window.__tools && document.querySelector('iframe')?.contentWindow.__st);

    const r = await t.page.evaluate(async () => {
        const T = window.__tools, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f) => {for (let i = 0; i < 250 && !await f(); i++) await sleep(20); return f();};
        const win = (tab) => T.S.frames[tab]?.contentWindow;

        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const proj = await dir(opfs, 'game');
        const json = await dir(proj, 'public', 'assets', 'json');
        await dir(proj, 'public', 'assets', 'textures');
        await dir(proj, 'images');
        await write(json, 'item.json', '{}');
        const disk = async () => {
            const fh = await (await proj.getDirectoryHandle('tools').catch(() => null))?.getFileHandle('settings.json').catch(() => null);
            return fh ? JSON.parse(await (await fh.getFile()).text()) : null;
        };

        // 紙娃娃舊的 localStorage 有整包數字：第一次拿到專案（沒有 settings.json）就搬過去，localStorage 只剩介面狀態
        localStorage.setItem('paperdoll.auto', JSON.stringify({helmet: {pct: 44, scale: 0.25, x: -1.75, y: -0.25}, kind: 'weapon', cls: 'bow'}));
        T.show('paperdoll');
        await until(() => win('paperdoll')?.__pd);
        await T.setProject(proj);
        out.migrate = await until(async () => (await disk())?.auto?.helmet) && [JSON.stringify(await disk()), JSON.parse(localStorage.getItem('paperdoll.auto')).kind,
                                                                                'helmet' in JSON.parse(localStorage.getItem('paperdoll.auto'))];

        T.show('settings');
        const st = win('settings').__st, doc = win('settings').document;
        const inp = (k) => doc.querySelector(`input[data-k="${k}"]`);
        const type = (k, v) => {const e = inp(k); e.value = v; e.dispatchEvent(new Event('change'));};
        out.shown = await until(() => inp('auto.helmet.pct')?.value === '44') && [inp('auto.helmet.pct').className, inp('auto.armor.pct').value, inp('auto.armor.pct').placeholder,
                                                                                    !!inp('auto.helmet.a'), !!inp('auto.weapon.bow.oy'), inp('auto.f.helmet.pct') === null];

        // 改值：只存改過的；填成跟內建一樣＝拿掉；清空＝回內建
        type('auto.armor.y', 30);
        await st.ST.flush();
        out.edit = [(await disk()).auto.armor.y, inp('auto.armor.y').className];
        type('auto.armor.y', 26.5);
        await st.ST.flush();
        out.same = [(await disk()).auto.armor, inp('auto.armor.y').value];
        type('auto.helmet.pct', '');
        await st.ST.flush();
        out.clear = [JSON.stringify(await disk()), inp('auto.helmet.pct').value];
        type('auto.helmet.scale', -1);
        out.bad = [st.ST.over().auto, doc.getElementById('status').textContent.includes('大於 0')];

        // undo／redo
        st.undo();
        await st.ST.flush();
        out.undo = [(await disk()).auto?.helmet?.pct, inp('auto.helmet.pct').value];
        st.redo();
        out.redo = inp('auto.helmet.pct').value;

        // 整列 ↺、步進
        type('auto.weapon.bow.ox', 0.9); type('auto.weapon.bow.a', 45);
        doc.querySelector('input[data-k="auto.weapon.bow.ox"]').closest('tr').querySelector('button').click();
        out.row = st.ST.over().auto?.weapon;
        type('step.xy', 0.5);
        out.step = [st.ST.step('x'), inp('auto.armor.x').step, inp('step.o').step];
        await st.ST.flush();
        const pd = win('paperdoll');
        out.pdStep = await until(() => pd.document.getElementById('pX').step === '0.5') && [pd.document.getElementById('au-helmet-y').step, pd.document.getElementById('bt-ox').step];

        // 紙娃娃那邊改數字：寫同一份，設定頁收到廣播重畫、undo 從現在重算
        pd.__pd.autoSet({...pd.__pd.S.auto, boots: {...pd.__pd.S.auto.boots, y: 40}});
        await pd.__pd.ST.flush();
        out.cross = await until(() => inp('auto.boots.y')?.value === '40') && [inp('auto.boots.y').value, st.S.hi, (await disk()).step.xy];

        // 全部回到內建（要確認）
        const p = st.resetAll('step', '步進');
        await until(() => doc.getElementById('dlgAsk').open);
        doc.getElementById('dlgAsk').close('ok');
        await p;
        await st.ST.flush();
        out.resetAll = [(await disk()).step, inp('step.xy').value, inp('step.xy').placeholder];
        out.pdBack = await until(() => pd.document.getElementById('pX').step === '0.25');
        return out;
    });

    t.eq('搬家：沒有 settings.json 時把紙娃娃 localStorage 的數字搬過去（只存改過的）、localStorage 只剩介面狀態',
         JSON.stringify(r.migrate), JSON.stringify([JSON.stringify({auto: {helmet: {pct: 44}}}), 'weapon', false]));
    t.eq('設定頁：改過的有值標色、沒改的空白灰字顯示內建、不適用的欄位沒有格子', JSON.stringify(r.shown), JSON.stringify(['changed', '', '20', false, true, true]));
    t.eq('改值寫進 settings.json', JSON.stringify(r.edit), JSON.stringify([30, 'changed']));
    t.eq('填成跟內建一樣＝拿掉 key', JSON.stringify(r.same), JSON.stringify([undefined, '']));
    t.eq('清空＝回內建（檔案變空）', JSON.stringify(r.clear), JSON.stringify(['{}', '']));
    t.eq('scale 填 0 以下不收、提示', JSON.stringify(r.bad), JSON.stringify([undefined, true]));
    t.eq('undo 回到 44、redo 再清掉', JSON.stringify([r.undo, r.redo]), JSON.stringify([[44, '44'], '']));
    t.eq('整列 ↺ 清掉那一列', JSON.stringify(r.row), JSON.stringify(undefined));
    t.eq('步進：x/y 共用 xy、設定頁自己的格子也套用', JSON.stringify(r.step), JSON.stringify([0.5, '0.5', '0.05']));
    t.eq('步進：紙娃娃收到廣播換 step', JSON.stringify(r.pdStep), JSON.stringify(['0.5', '0.05']));
    t.eq('紙娃娃改數字：設定頁重畫、undo 重算、不蓋掉別的設定', JSON.stringify(r.cross), JSON.stringify(['40', 0, 0.5]));
    t.eq('全部回到內建：步進清掉、灰字顯示內建', JSON.stringify(r.resetAll), JSON.stringify([undefined, '', '0.25']));
    t.check('全部回到內建：紙娃娃步進跟著回來', r.pdBack);
});
