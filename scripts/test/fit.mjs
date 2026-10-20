// 試穿（tools/fit）：用 window.__fit 直接呼叫，OPFS 當假的專案根目錄（public/assets/json 放 role.json、item.json）
import {run} from './harness.mjs'

run('fit', async t => {
    await t.page.goto(new URL('tools/fit/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__fit);

    const r = await t.page.evaluate(async () => {
        const F = window.__fit, S = F.S, out = {}, $ = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const save = async (...answers) => {
            let done = false;
            const p = F.save().finally(() => {done = true;}), seen = [];
            while (!done)
            {
                if ($('dlgAsk').open) {seen.push($('dlgAsk').textContent); $('dlgAsk').close(answers.shift() ?? 'cancel');}
                await sleep(20);
            }
            await p;
            return seen;
        };
        const fire = (k, v) => {const el = document.querySelector(`[data-k="${k}"]`); el.value = v; el.dispatchEvent(new Event('change'));};
        const drawn = async () => {await F.drawPreview(); return +document.querySelector('#pv canvas').dataset.drawn;};

        const origRole = await (await fetch('/assets/json/role.json')).text();
        const origItem = await (await fetch('/assets/json/item.json')).text();
        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const proj = await dir(opfs, 'game');
        const json = await dir(proj, 'public', 'assets', 'json');
        const disk = async (f) => (await (await json.getFileHandle(f)).getFile()).text();
        await write(json, 'role.json', origRole);
        await write(json, 'item.json', origItem);

        await F.setRoot(proj);
        await F.IC.ready;
        const dolls = Object.entries(JSON.parse(origRole)).filter(([, v]) => v.head || v.hand).map(([k]) => k);
        out.list = [document.querySelectorAll('#list .item').length, dolls.length, S.rid === dolls[0]];

        // 選角色帶入原裝
        F.select('guard-1');
        out.slots = JSON.stringify(S.slots);
        out.drawn = await drawn();
        F.setSlot('CAT_GLOVES', 'gloves_01');
        out.gloves = [await drawn() > out.drawn, JSON.stringify(S.doc['role.json'].data['guard-1'].inv.equips)];
        const dlg = $('dlgEquip');
        out.slotOpts = [...document.querySelectorAll('#view .slot')].map(s => {s.click(); const n = dlg.querySelectorAll('.tile').length; dlg.close(); return n;});
        out.slotIcons = document.querySelectorAll('#view .slot .ico.empty').length;
        document.querySelector('#view .slot[data-cat=CAT_BOOTS]').click();
        dlg.querySelector('.tile[data-id=boots_01]').click();
        out.boots = [S.slots.CAT_BOOTS, dlg.open, S.cur, document.querySelector('#view .equipname').textContent.includes('boots_01')];
        F.pickEquip('CAT_BOOTS');
        dlg.querySelector('.tile[data-id=""]').click();
        out.unequip = 'CAT_BOOTS' in S.slots;
        F.pickEquip('CAT_HELMET'); dlg.close();

        // 改數字：裝備寫 item.json、部件寫 role.json、清空刪 key、undo 一起退
        fire('item.json|helmet_01|equip.y', '5');
        out.equipY = S.doc['item.json'].data.helmet_01.equip.y;
        fire('role.json|guard-1|body.x', '-2');
        out.bodyX = S.doc['role.json'].data['guard-1'].body.x;
        fire('item.json|helmet_01|equip.scale', '');
        out.cleared = 'scale' in S.doc['item.json'].data.helmet_01.equip;
        fire('item.json|helmet_01|equip.x', 'abc');
        out.badNum = 'x' in S.doc['item.json'].data.helmet_01.equip;
        out.dirty = [!$('dirty').hidden, !!document.querySelector('#list .item.sel .mark')];
        F.undo(); F.undo();
        out.undo = [S.doc['item.json'].data.helmet_01.equip.y, S.doc['role.json'].data['guard-1'].body.x];
        F.redo();
        out.redo = S.doc['role.json'].data['guard-1'].body.x;

        // 武器姿勢：劍有 swing 沒 aim、弓有 aim
        const f = (await F.IC.frameOf(S.doc['item.json'].data.sword_01.equip.sprite)).f;
        out.poseOk = [F.poseOk('aim'), F.poseOk('chop'), F.poseOk('sweep')];
        const sw = S.doc['item.json'].data.sword_01.equip;
        S.pose = 'chop';
        const chop = F.poseAt(sw, f, Infinity);
        const mid = F.poseAt(sw, f, 120);
        S.pose = 'sweep'; S.target = 180;
        const sweep = F.poseAt(sw, f, Infinity);
        out.chop = [chop.total, Math.abs(chop.x - (sw.x ?? 0)) < 1e-6 && Math.abs(chop.y - sw.y) < 1e-6 && Math.abs(((chop.angle % 360) + 360) % 360) < 1e-6, mid.angle < -45];
        out.sweep = sweep.total;
        S.t = 0.5; F.render();
        out.posed = [await drawn(), !!document.querySelector('#pv input[type=range]'), document.querySelector('#pv input[type=checkbox][disabled]')?.parentElement.textContent];
        F.setSlot('CAT_WEAPON', 'bow_01');
        out.bow = [F.poseOk('aim'), F.poseOk('chop'), S.pose];
        S.pose = 'aim'; S.target = 0;
        const bow = S.doc['item.json'].data.bow_01.equip;
        out.aimTotal = F.poseAt(bow, f, Infinity).total;
        out.aimMid = Math.round(F.poseAt(bow, f, 60).angle);
        S.pose = ''; S.zoom = 'game'; F.render();
        await F.drawPreview();
        out.game = parseFloat(document.querySelector('#pv canvas').style.width);
        out.dom = document.body.innerText.includes('[object');

        // 頭盔 hideHair：戴上藏頭髮、取消勾選頭髮回來
        S.zoom = 3; F.select('wick');
        const bare = await drawn();
        S.cur = 'CAT_HELMET'; F.setSlot('CAT_HELMET', 'helmet_02');
        const hide = document.querySelector('[data-k="item.json|helmet_02|equip.hideHair"]');
        out.hair = [bare, await drawn(), !!document.querySelector('#view .hidden-hair'), hide.checked];
        hide.checked = false; hide.dispatchEvent(new Event('change'));
        out.hair.push(await drawn(), 'hideHair' in S.doc['item.json'].data.helmet_02.equip, !!document.querySelector('#view .hidden-hair'));
        F.undo();
        out.hair.push(S.doc['item.json'].data.helmet_02.equip.hideHair);
        F.select('guard-1'); S.cur = 'CAT_HELMET'; F.render();

        // 存檔：只寫有改的檔；外部修改合併
        const seen = await save();
        out.saved = [seen.length, JSON.parse(await disk('role.json'))['guard-1'].body.x, (await disk('item.json')) === origItem, $('dirty').hidden];
        const ext = JSON.parse(await disk('item.json'));
        ext.boots_01.gold = 999;
        await write(json, 'item.json', JSON.stringify(ext, null, 2));
        fire('item.json|helmet_01|equip.y', '7');
        const seen2 = await save('merge');
        const after = JSON.parse(await disk('item.json'));
        out.merge = [seen2.length, after.boots_01.gold, after.helmet_01.equip.y];
        return out;
    });

    t.check('清單只列紙娃娃型角色', r.list[0] === r.list[1] && r.list[2], JSON.stringify(r.list));
    t.eq('選角色帶入原裝', r.slots, JSON.stringify({CAT_WEAPON: 'sword_01', CAT_HELMET: 'helmet_01', CAT_CHESTPLATE: 'chest_01'}));
    t.check('預覽畫出部件與裝備', r.drawn >= 4, `${r.drawn}`);
    t.check('換上手套多畫一張', r.gloves[0]);
    t.eq('換裝不寫回 inv.equips', r.gloves[1], JSON.stringify(['sword_01', 'helmet_01', 'chest_01']));
    t.check('挑選視窗只列有 equip 的道具（含卸下）', r.slotOpts.every(n => n >= 2), JSON.stringify(r.slotOpts));
    t.eq('只有靴子格是空的剪影', r.slotIcons, 1);
    t.eq('點 icon 穿上、關窗、選中該格', JSON.stringify(r.boots), JSON.stringify(['boots_01', false, 'CAT_BOOTS', true]));
    t.eq('卸下', r.unequip, false);
    t.eq('改裝備寫 item.json', r.equipY, 5);
    t.eq('改部件寫 role.json', r.bodyX, -2);
    t.eq('清空刪 key', r.cleared, false);
    t.eq('不是數字不寫', r.badNum, false);
    t.check('未存標記', r.dirty[0] && r.dirty[1]);
    t.eq('undo 跨兩個檔', JSON.stringify(r.undo), JSON.stringify([5, undefined]));
    t.eq('redo', r.redo, -2);
    t.eq('劍：可下劈／橫掃、不能瞄準', JSON.stringify(r.poseOk), JSON.stringify([false, true, true]));
    t.eq('下劈總長 120+80+150', r.chop[0], 350);
    t.check('下劈結束回到原姿勢', r.chop[1]);
    t.check('舉劍時往後轉', r.chop[2]);
    t.eq('橫掃總長 120+300+150', r.sweep, 570);
    t.check('姿勢預覽有畫、有滑桿、翻面反灰', r.posed[0] >= 4 && r.posed[1] && r.posed[2] === '翻面', JSON.stringify(r.posed));
    t.eq('弓：只能瞄準、姿勢跳回靜止', JSON.stringify(r.bow), JSON.stringify([true, false, '']));
    t.eq('瞄準總長 60+60', r.aimTotal, 120);
    t.eq('瞄準正右方：原生朝向 45° 的弓轉 -45°', r.aimMid, -45);
    t.check('遊戲大小倍率', r.game > 0 && r.game < 400, `${r.game}`);
    t.eq('畫面沒有 [object …]', r.dom, false);
    const [bare, helm, hint, chk, off, key, hint2, undone] = r.hair;
    t.check('hideHair 頭盔：頭髮換成頭盔、張數不變、有提示、勾選框打勾', helm === bare && hint && chk, JSON.stringify(r.hair));
    t.check('取消藏頭髮：多畫頭髮、刪 key、提示消失', off === helm + 1 && !key && !hint2, JSON.stringify(r.hair));
    t.eq('藏頭髮可 undo', undone, true);
    t.check('只存有改的檔', r.saved[0] === 0 && r.saved[1] === -2 && !r.saved[2] && r.saved[3], JSON.stringify(r.saved));
    t.eq('外部修改合併', JSON.stringify(r.merge), JSON.stringify([1, 999, 7]));
});
