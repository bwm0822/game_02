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
        const isDirtyNow = () => !$('dirty').hidden;
        const drawn = async () => {await F.drawPreview(); return +document.querySelector('#pv canvas').dataset.drawn;};

        const origRole = await (await fetch('/assets/json/role.json')).text();
        const origItem = await (await fetch('/assets/json/item.json')).text();
        // 動畫用固定資料，實際 anim.json 數值常調不會弄壞測試
        const origAnim = await (await fetch('/scripts/test/fixtures/anim.json')).text();
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
        out.defFold = [S.rid, document.querySelectorAll('#list .item').length];
        [...document.querySelectorAll('#list .group')].find(g => g.textContent.startsWith('▸'))?.dispatchEvent(new MouseEvent('click', {altKey: true, bubbles: true}));
        out.list = [document.querySelectorAll('#list .item').length, dolls.length];

        // 選角色不帶裝備，「穿原裝」才帶入
        F.select('guard-1');
        out.opts = [...document.querySelectorAll('#pv .opts input[type=checkbox]')].slice(0, 5).map(c => c.checked);
        out.slots0 = JSON.stringify(S.slots);
        document.querySelector('#view .orig').click();
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

        // 透明度：每格各自、只影響預覽、換角色保留、格子標 %
        const kept = JSON.stringify(S.slots);
        const bar = document.querySelector('#view .alphabar input[type=range]');
        bar.value = 40; bar.dispatchEvent(new Event('input')); bar.dispatchEvent(new Event('change'));
        const helmA = () => F.partsOf(S.doc['role.json'].data[S.rid]).find(p => p.sprite === S.doc['item.json'].data.helmet_01.equip.sprite)?.alpha;
        out.alpha = [S.alpha.CAT_HELMET, helmA(), !!document.querySelector('#view .slot[data-cat=CAT_HELMET] .alpha'), !!document.querySelector('#view .slot[data-cat=CAT_WEAPON] .alpha'), isDirtyNow()];
        F.select('wick');
        out.keep = [JSON.stringify(S.slots) === kept, S.alpha.CAT_HELMET, S.cur];
        F.setAlpha('CAT_HELMET', 1); F.render();
        out.alpha.push('CAT_HELMET' in S.alpha, !!document.querySelector('#view .slot .alpha'));
        F.select('guard-1');

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
        const sw = S.doc['item.json'].data['sword-1'].equip;
        document.querySelector('.tab[data-mode=anim]').click();
        out.animUi = [S.mode, S.aid, document.querySelectorAll('table.keys tr').length - 1, document.querySelectorAll('.timeline .mark.key').length];
        const chop = F.trackOf();
        const {poseAt, trackEnd} = await import('/src/core/pose.js');
        const end = poseAt(chop, trackEnd(chop)), raised = poseAt(chop, 120);
        out.chop = [trackEnd(chop), Math.abs(end.x - sw.x) < 1e-6 && Math.abs(end.y - sw.y) < 1e-6 && Math.abs(end.angle - (sw.a ?? 0)) < 1e-6, raised.angle];
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
        const optNone = () => document.querySelector('.animbar select').value;
        F.setSlot('CAT_WEAPON', 'dagger-1');
        out.weaponAnim = [S.aid];
        F.setSlot('CAT_WEAPON', 'bow-1');
        out.weaponAnim.push(S.aid);
        F.setSlot('CAT_WEAPON', 'sword-1');
        out.weaponAnim.push(S.aid);
        F.setSlot('CAT_WEAPON', null);
        out.weaponAnim.push(S.aid, optNone(), !!document.querySelector('table.keys'));
        I()['sword-1'].anim = 'nope'; F.setSlot('CAT_WEAPON', 'sword-1');
        out.weaponAnim.push(S.aid, $('status')?.textContent.includes('nope'));
        delete I()['sword-1'].anim;
        F.setSlot('CAT_WEAPON', 'dagger-1');
        F.renameAnim('stab2');
        out.stabRename = [I()['dagger-1'].anim, I()['dagger-5'].anim];
        F.undo();
        out.stabRename.push(I()['dagger-1'].anim);
        S.aid = 'stab'; F.render();
        const del = F.delAnim();
        $('dlgAsk').close('ok'); await del;
        out.delAnim = [Object.keys(A()).join(), S.aid, 'anim' in I()['dagger-1'], 'anim' in I()['dagger-5'], optNone()];
        F.undo();
        out.delAnim.push(Object.keys(A()).join(), I()['dagger-1'].anim);
        F.setSlot('CAT_WEAPON', 'bow-1');
        S.aid = 'aim'; S.target = 0; F.render();
        out.aim = [trackEnd(F.trackOf()), Math.round(poseAt(F.trackOf(), 60).angle)];
        const zin = () => document.querySelector('#pv input.zoom');
        const zset = (v) => {zin().value = v; zin().dispatchEvent(new Event('change'));};
        const zkey = (key) => {zin().dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true})); return S.zoom;};
        zset('1.41'); out.zstep = [zkey('ArrowUp')];
        zset('1.41'); out.zstep.push(zkey('ArrowDown'), zkey('ArrowDown'), zkey('ArrowUp'));
        zset('0.1'); out.zstep.push(zkey('ArrowDown'));
        zset('9'); out.zstep.push(S.zoom, zkey('ArrowUp'));
        zset('abc'); out.zstep.push(S.zoom, zin().value);
        const spin = (v) => {zin().value = v; zin().dispatchEvent(new Event('input')); return S.zoom;};
        zset('1.41'); out.zspin = [zin().type, spin('2.41')];
        zset('1'); out.zspin.push(spin('0.9'), spin('0.95'));
        // 真的 spinner：stepDown/stepUp 照 step 改值，1 要能往下
        const real = (dir) => {dir > 0 ? zin().stepUp() : zin().stepDown(); zin().dispatchEvent(new Event('input')); return S.zoom;};
        zset('1'); out.zspin.push(real(-1), real(1), real(1));
        zset('6'); out.zspin.push(real(-1));
        zset('6');
        await F.drawPreview();
        const stage = () => document.querySelector('#pv .stage');
        const ctrl = document.querySelector('#pv .ctrl').getBoundingClientRect();
        const st = stage();
        const scrolls = st.scrollHeight > st.clientHeight;
        const centered = Math.abs(st.scrollTop - (st.scrollHeight - st.clientHeight) / 2) <= 1;
        const scrolled = new Promise(res => st.addEventListener('scroll', res, {once: true}));
        st.scrollTop = 40; st.scrollLeft = 30;
        // 刪除確認框 showModal 過後，scroll 事件要過一陣子才發
        await Promise.race([scrolled, sleep(2000)]);
        fire(`anim.json|aim|back`, '70');
        await F.drawPreview();
        out.pinned = [ctrl.bottom <= innerHeight, scrolls, centered, stage().scrollTop, stage().scrollLeft];
        S.zoom = 3;
        F.setSlot('CAT_WEAPON', 'sword-1');
        S.mode = 'fit'; F.render();
        document.querySelector('#pv .gamezoom').click();
        await F.drawPreview();
        out.game = [parseFloat(document.querySelector('#pv canvas').style.width), S.zoom === Math.round(Math.min(screen.width / 1024, screen.height / 768) * 100) / 100, zin().value === String(S.zoom)];
        out.dom = document.body.innerText.includes('[object');

        // 頭盔 hideHair：戴上藏頭髮、取消勾選頭髮回來
        S.zoom = 3; F.select('wick'); F.wearOrig();
        const bare = await drawn();
        S.cur = 'CAT_HELMET'; F.setSlot('CAT_HELMET', 'helmet_02');
        const hide = document.querySelector('[data-k="item.json|helmet_02|equip.hideHair"]');
        out.hair = [bare, await drawn(), !!document.querySelector('#view .hidden-hair'), hide.checked];
        hide.checked = false; hide.dispatchEvent(new Event('change'));
        out.hair.push(await drawn(), 'hideHair' in S.doc['item.json'].data.helmet_02.equip, !!document.querySelector('#view .hidden-hair'));
        F.undo();
        out.hair.push(S.doc['item.json'].data.helmet_02.equip.hideHair);

        // 女角：scale/x/y 改的是 equip.f，第一次改從基準複製；a 還是改基準；刪除女版回到共用
        F.select('mary'); S.cur = 'CAT_HELMET'; F.setSlot('CAT_HELMET', 'helmet_02');
        const e2 = () => S.doc['item.json'].data.helmet_02.equip, base = {...e2()};
        out.sex = [!!document.querySelector('[data-k="item.json|helmet_02|equip.f.y"]'), !document.querySelector('#view .delsex')];
        fire('item.json|helmet_02|equip.f.y', '9');
        out.sex.push(JSON.stringify(e2().f) === JSON.stringify({scale: base.scale, ...(base.x !== undefined && {x: base.x}), y: 9}), e2().y === base.y);
        fire('item.json|helmet_02|equip.f.scale', '0.2');
        out.sex.push(e2().f.scale, F.partsOf(S.doc['role.json'].data.mary).find(p => p.sprite === e2().sprite).p.y);
        document.querySelector('#view .delsex').click();
        out.sex.push('f' in e2());
        F.undo(); F.undo(); F.undo();
        out.sex.push('f' in e2());
        F.select('guard-1'); F.wearOrig(); S.cur = 'CAT_HELMET'; F.render();

        // 背景色：純色鋪滿、記 localStorage、棋盤格按鈕恢復
        const corner = async () => {await F.drawPreview(); const c = document.querySelector('#pv canvas'); return [...c.getContext('2d').getImageData(0, 0, 1, 1).data].slice(0, 3).join();};
        const bgIn = document.querySelector('#pv input.bg');
        bgIn.value = '#ff0000'; bgIn.dispatchEvent(new Event('change'));
        out.bg = [await corner(), localStorage.getItem('tools.fit.bg'), document.querySelector('#pv .bgchk').disabled];
        document.querySelector('#pv .bgchk').click();
        out.bg.push(await corner(), localStorage.getItem('tools.fit.bg'), document.querySelector('#pv .bgchk').disabled);

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

    t.eq('一打開不選角色、左欄全部摺起來', JSON.stringify(r.defFold), JSON.stringify([null, 0]));
    t.check('清單只列紙娃娃型角色', r.list[0] === r.list[1], JSON.stringify(r.list));
    t.eq('虛線／錨點／b／g／z 預設不勾', JSON.stringify(r.opts), JSON.stringify([false, false, false, false, false]));
    t.eq('選角色不帶原裝', r.slots0, '{}');
    t.eq('穿原裝', r.slots, JSON.stringify({CAT_WEAPON: 'sword-1', CAT_HELMET: 'helmet_01', CAT_CHESTPLATE: 'chest_01'}));
    t.eq('透明度：存在格子、預覽套用、標 %、只標那格、不算修改', JSON.stringify(r.alpha.slice(0, 5)), JSON.stringify([0.4, 0.4, true, false, false]));
    t.eq('換角色裝備、透明度、選中格都保留', JSON.stringify(r.keep), JSON.stringify([true, 0.4, 'CAT_HELMET']));
    t.eq('透明度 100% 刪掉、% 標記消失', JSON.stringify(r.alpha.slice(5)), JSON.stringify([false, false]));
    t.check('預覽畫出部件與裝備', r.drawn >= 4, `${r.drawn}`);
    t.check('換上手套多畫一張', r.gloves[0]);
    t.eq('換裝不寫回 inv.equips', r.gloves[1], JSON.stringify(['sword-1', 'helmet_01', 'chest_01']));
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
    t.eq('動畫分頁：劍沒寫 anim 用預設 chop、表格與時間軸各 2 格', JSON.stringify(r.animUi), JSON.stringify(['anim', 'chop', 2, 2]));
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
    t.eq('換武器切動畫：匕首 stab、弓預設 aim、劍預設 chop、空手（無）隱藏編輯區、anim 不存在（無）＋提示',
        JSON.stringify(r.weaponAnim), JSON.stringify(['stab', 'aim', 'chop', null, '', false, null, true]));
    t.eq('改名連帶改道具 anim、undo 一起退', JSON.stringify(r.stabRename), JSON.stringify(['stab2', 'stab2', 'stab']));
    t.eq('刪除動畫：停在（無）、清掉道具 anim、undo 一起退', JSON.stringify(r.delAnim),
        JSON.stringify(['chop,sweep,aim', null, false, false, '', 'chop,sweep,stab,aim', 'stab']));
    t.eq('瞄準：總長 60+60、正右方 0°', JSON.stringify(r.aim), JSON.stringify([120, 0]));
    t.eq('×6：控制面板留在畫面上、畫布區自己捲、換倍率置中、重繪保留捲動', JSON.stringify(r.pinned), JSON.stringify([true, true, true, 40, 30]));
    t.check('「遊戲」按鈕填入螢幕算出的倍率', r.game[0] > 0 && r.game[0] < 400 && r.game[1] && r.game[2], JSON.stringify(r.game));
    t.eq('倍率 ↑↓ 吸格、夾範圍、亂打恢復', JSON.stringify(r.zstep), JSON.stringify([2, 1, 0.9, 1, 0.1, 6, 6, 6, '6']));
    t.eq('倍率上下三角形也吸格', JSON.stringify(r.zspin), JSON.stringify(['number', 2, 0.9, 1, 0.9, 1, 2, 5]));
    t.eq('畫面沒有 [object …]', r.dom, false);    const [bare, helm, hint, chk, off, key, hint2, undone] = r.hair;
    t.check('hideHair 頭盔：頭髮換成頭盔、張數不變、有提示、勾選框打勾', helm === bare && hint && chk, JSON.stringify(r.hair));
    t.check('取消藏頭髮：多畫頭髮、刪 key、提示消失', off === helm + 1 && !key && !hint2, JSON.stringify(r.hair));
    t.eq('藏頭髮可 undo', undone, true);
    t.eq('女角改 equip.f（從基準複製、基準不動）、預覽套 f、刪除女版、undo', JSON.stringify(r.sex), JSON.stringify([true, true, true, true, 0.2, 9, false, false]));
    t.eq('背景色：純色、記住、棋盤格恢復', JSON.stringify(r.bg), JSON.stringify(['255,0,0', '#ff0000', false, '34,36,40', null, true]));
    t.check('只存有改的檔', r.saved[0] === 0 && r.saved[1] === -2 && !r.saved[2] && r.saved[3], JSON.stringify(r.saved));
    t.eq('外部修改合併', JSON.stringify(r.merge), JSON.stringify([1, 999, 7]));
});
