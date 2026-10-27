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
        const origAnim = await (await fetch('/assets/json/anim.json')).text();
        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const proj = await dir(opfs, 'game');
        const json = await dir(proj, 'public', 'assets', 'json');
        const disk = async (f) => (await (await json.getFileHandle(f)).getFile()).text();
        await write(json, 'role.json', origRole);
        await write(json, 'item.json', origItem);
        await write(json, 'anim.json', origAnim);

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

        // 動畫模式：pose.js 算時間軸、加影格、畫布拖拉、改名、播放暫停
        const A = () => S.doc['anim.json'].data;
        const sw = S.doc['item.json'].data.sword_01.equip;
        document.querySelector('.tab[data-mode=anim]').click();
        out.animUi = [S.mode, S.aid, document.querySelectorAll('table.keys tr').length - 1, document.querySelectorAll('.timeline .mark.key').length];
        const chop = F.trackOf();
        const {poseAt, trackEnd} = await import('/src/core/pose.js');
        const end = poseAt(chop, trackEnd(chop)), raised = poseAt(chop, 120);
        out.chop = [trackEnd(chop), Math.abs(end.x - sw.x) < 1e-6 && Math.abs(end.y - sw.y) < 1e-6 && Math.abs(end.angle) < 1e-6, raised.angle];
        out.playMs = [F.playMs(A().chop, chop, 150), F.playMs(A().chop, chop, 250)];
        S.aid = 'sweep'; S.target = 90; F.render();
        const down = poseAt(F.trackOf(), 120);
        S.target = 180; F.render();
        out.sweep = [trackEnd(F.trackOf()), [Math.round(down.x), Math.round(down.y), Math.round(down.angle)], document.querySelector('#pv input[type=checkbox][disabled]')?.parentElement.textContent];
        S.aid = 'chop'; S.target = 0; F.setMs(200); F.render();
        const addBtn = () => [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('＋'))?.textContent;
        out.addBtn = [addBtn()];
        F.addKey();
        out.addKey = [A().chop.keys.map(k => k.t).join(), S.key, Math.round(A().chop.keys[1].a)];
        F.pickKey(1);
        out.addBtn.push(S.key, addBtn());
        F.addKey();
        out.addLast = [A().chop.keys.map(k => k.t).join(), S.key];
        F.undo();
        F.pickKey(1);
        dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
        out.esc = S.key;
        const ks = A().chop.keys;
        ks[1].t = 121; F.setMs(121);
        F.addKey();
        out.tight = [ks.length, $('status')?.textContent ?? ''];
        ks[1].t = 160;
        F.setMs(120); F.render();
        await F.drawPreview();
        const cv = document.querySelector('#pv canvas'), rc = cv.getBoundingClientRect(), g = F.geo;
        const at = (x, y) => ({clientX: rc.left + (g.vc.x + x) * g.K, clientY: rc.top + (g.vc.y + y) * g.K, pointerId: 1, bubbles: true});
        const o = g.wp.pose;
        const ptr = (type, p) => document.querySelector('#pv canvas').dispatchEvent(new PointerEvent(type, p));
        ptr('pointerdown', at(o.x, o.y)); ptr('pointermove', at(o.x + 3, o.y - 2)); ptr('pointerup', at(o.x + 3, o.y - 2));
        const k0 = A().chop.keys[0];
        out.dragMove = [k0.x, k0.y];
        await F.drawPreview();
        const o2 = F.geo.wp.pose, hd = F.geo.hd;
        ptr('pointerdown', at(hd.x, hd.y));
        const rr = Math.hypot(hd.x - o2.x, hd.y - o2.y), a1 = Math.atan2(hd.y - o2.y, hd.x - o2.x) + Math.PI / 2;
        const rot = {...at(o2.x + Math.cos(a1) * rr, o2.y + Math.sin(a1) * rr), shiftKey: true};
        ptr('pointermove', rot); ptr('pointerup', rot);
        out.dragRot = A().chop.keys[0].a;
        F.undo(); F.undo();
        out.dragUndo = [A().chop.keys[0].x, A().chop.keys[0].a];
        F.renameAnim('chop2');
        out.rename = [Object.keys(A()).join(), S.aid];
        F.undo();
        out.renameUndo = Object.keys(A()).join();
        const I = () => S.doc['item.json'].data;
        F.setSlot('CAT_WEAPON', 'dagger-1');
        out.weaponAnim = [S.aid];
        F.setSlot('CAT_WEAPON', 'sword_01');
        out.weaponAnim.push(S.aid);
        F.renameAnim('stab2');
        out.stabRename = [I()['dagger-1'].anim, I()['dagger-5'].anim];
        F.undo();
        out.stabRename.push(I()['dagger-1'].anim);
        F.setSlot('CAT_WEAPON', 'bow_01');
        S.aid = 'aim'; S.target = 0; F.render();
        out.aim = [trackEnd(F.trackOf()), Math.round(poseAt(F.trackOf(), 60).angle)];
        const zsel = document.querySelector('#pv .ctrl select');
        zsel.value = '6'; zsel.dispatchEvent(new Event('change'));
        await F.drawPreview();
        const stage = () => document.querySelector('#pv .stage');
        const ctrl = document.querySelector('#pv .ctrl').getBoundingClientRect();
        const st = stage();
        const scrolls = st.scrollHeight > st.clientHeight;
        const centered = Math.abs(st.scrollTop - (st.scrollHeight - st.clientHeight) / 2) <= 1;
        st.scrollTop = 40; st.scrollLeft = 30;
        await sleep(50);
        fire(`anim.json|aim|back`, '70');
        await F.drawPreview();
        out.pinned = [ctrl.bottom <= innerHeight, scrolls, centered, stage().scrollTop, stage().scrollLeft];
        S.zoom = 3;
        F.setSlot('CAT_WEAPON', 'sword_01');
        S.mode = 'fit'; S.zoom = 'game'; F.render();
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
    t.eq('動畫分頁：預設第一個動畫、表格與時間軸各 2 格', JSON.stringify(r.animUi), JSON.stringify(['anim', 'chop', 2, 2]));
    t.eq('下劈總長 200+收回 150', r.chop[0], 350);
    t.check('下劈結束回到原姿勢', r.chop[1]);
    t.eq('舉劍 -90°', r.chop[2], -90);
    t.eq('播放：ready 停 100ms', JSON.stringify(r.playMs), JSON.stringify([120, 150]));
    t.eq('橫掃總長 420+150', r.sweep[0], 570);
    t.eq('橫掃目標朝下：起手繞支點轉 90°', JSON.stringify(r.sweep[1]), JSON.stringify([14, 0, 45]));
    t.eq('動畫模式翻面反灰', r.sweep[2], '翻面');
    t.check('新增影格：選 #2 插在它跟前一格中間、選中新格、角度取補間', r.addKey[0] === '120,160,200' && r.addKey[1] === 1 && r.addKey[2] > -90 && r.addKey[2] < 75, JSON.stringify(r.addKey));
    t.eq('新增影格按鈕：選了／取消選取後的文字', JSON.stringify(r.addBtn), JSON.stringify(['＋ 插在 #2 之前', -1, '＋ 新增影格（最後）']));
    t.eq('沒選影格：接在最後＋back/2、選中新格', JSON.stringify(r.addLast), JSON.stringify(['120,160,200,275', 3]));
    t.eq('Esc 取消選取', r.esc, -1);
    t.check('間隔太小插不進去、提示', r.tight[0] === 3 && r.tight[1].includes('間隔太小'), JSON.stringify(r.tight));
    t.check('拖武器改選中影格位置', r.dragMove[0] === -10 && r.dragMove[1] === 4, JSON.stringify(r.dragMove));
    t.eq('拖把手轉 90°（Shift 吸 15°）', r.dragRot, 0);
    t.eq('拖拉各一筆 undo', JSON.stringify(r.dragUndo), JSON.stringify([-13, -90]));
    t.eq('改名保留順序', JSON.stringify(r.rename), JSON.stringify(['chop2,sweep,stab,aim', 'chop2']));
    t.eq('改名可 undo', r.renameUndo, 'chop,sweep,stab,aim');
    t.eq('換匕首切到 stab、換沒寫 anim 的劍不切', JSON.stringify(r.weaponAnim), JSON.stringify(['stab', 'stab']));
    t.eq('改名連帶改道具 anim、undo 一起退', JSON.stringify(r.stabRename), JSON.stringify(['stab2', 'stab2', 'stab']));
    t.eq('瞄準：總長 60+60、正右方 -45°', JSON.stringify(r.aim), JSON.stringify([120, -45]));
    t.eq('×6：控制面板留在畫面上、畫布區自己捲、換倍率置中、重繪保留捲動', JSON.stringify(r.pinned), JSON.stringify([true, true, true, 40, 30]));
    t.check('遊戲大小倍率', r.game > 0 && r.game < 400, `${r.game}`);
    t.eq('畫面沒有 [object …]', r.dom, false);
    const [bare, helm, hint, chk, off, key, hint2, undone] = r.hair;
    t.check('hideHair 頭盔：頭髮換成頭盔、張數不變、有提示、勾選框打勾', helm === bare && hint && chk, JSON.stringify(r.hair));
    t.check('取消藏頭髮：多畫頭髮、刪 key、提示消失', off === helm + 1 && !key && !hint2, JSON.stringify(r.hair));
    t.eq('藏頭髮可 undo', undone, true);
    t.check('只存有改的檔', r.saved[0] === 0 && r.saved[1] === -2 && !r.saved[2] && r.saved[3], JSON.stringify(r.saved));
    t.eq('外部修改合併', JSON.stringify(r.merge), JSON.stringify([1, 999, 7]));
});
