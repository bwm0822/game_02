// 裝備／部位的 sex 限定：node scripts/test/sex.mjs
import {run} from './harness.mjs'

run('性別限定', async t => {
    await t.waitFor(d => d?.game.scene.isActive('MainMenu'), {what:'主選單'});
    await t.newGame('mary');

    const r = await t.eval(async d => {
        const {default: UiDragged} = await import('/src/ui/uidragged.js');
        const {default: UiInv} = await import('/src/ui/uiinv.js');
        const {equipFor, sexOk} = await import('/src/core/equip.js');
        const out = {};
        const id = d.DB.itemIds().find(k => d.DB.item(k).cat === d.GM.CAT.HELMET && d.DB.item(k).equip?.f);
        const dat = d.DB.item(id);
        const slots = [];
        UiInv.instance._equips.loop(s => s && slots.push(s));
        const slot = slots.find(s => s.cat === d.GM.CAT.HELMET);
        slot.owner = d.GM.player;
        const was = UiDragged.instance._obj;
        UiDragged.instance._obj = {dat};
        const valid = () => slot.isValid;
        out.sex = d.GM.player.bb.meta.sex;
        out.none = valid();
        dat.sex = 'm';
        out.male = [valid(), sexOk(dat, 'f'), sexOk(dat, undefined)];
        dat.sex = 'f';
        out.female = valid();
        // 有 sex 就不套 f：基準數字直接用
        out.drawF = [equipFor(dat.equip, 'f', dat.sex).scale === dat.equip.scale, equipFor(dat.equip, 'f').scale === dat.equip.f.scale];
        // 部位條目自己帶 sex
        out.part = equipFor({scale: 1, sex: 'f', f: {scale: 2}}, 'f').scale;
        delete dat.sex;
        UiDragged.instance._obj = was;
        return out;
    });
    t.eq('瑪莉是女角', r.sex, 'f');
    t.check('沒寫 sex：可以放', r.none);
    t.eq('限男：女角的裝備格不能放；sexOk 角色沒寫 sex＝男', JSON.stringify(r.male), '[false,false,true]');
    t.check('限女：可以放', r.female);
    t.eq('有 sex 不套 equip.f、沒有照舊套', JSON.stringify(r.drawF), '[true,true]');
    t.eq('部位條目有 sex 不套 f', r.part, 1);
});
