// 多國語言 tr()：node scripts/test/lang.mjs
import {run} from './harness.mjs'

run('多國語言', async t => {
    await t.waitFor(d => d?.game.scene.isActive('MainMenu'), {what:'主選單'});

    const zh = await t.eval(d => ({
        item: d.DB.item('sword_01').lab,
        ability: d.DB.ability('fireball').lab,
        des: d.DB.ability('fireball').des,
        ui: d.Local.lab('weapon'),
        missing: d.Local.lab('no_such_key'),
        fill: d.Lang.tr('x', '{#num} 格 {#keep}', {num:3}),
    }));
    t.eq('item 原文', zh.item, '匕首');
    t.eq('ability 原文', zh.ability, '火球術');
    t.check('ability 說明保留佔位符給 fmt_Des', zh.des.includes('{#fmt}'), zh.des);
    t.eq('local 原文', zh.ui, '武器');
    t.eq('local 查不到標紅', zh.missing, '[color=red]no_such_key[/color]');
    t.eq('佔位符只換有給的', zh.fill, '3 格 {#keep}');

    const qps = await t.eval(d => {
        d.Record.setting.lang = 'qps';
        d.DB.load(d.game.scene.getScene('MainMenu'));
        d.DB.load(d.game.scene.getScene('MainMenu'));
        const r = {
            item: d.DB.item('sword_01').lab,
            role: d.DB.role('karen').lab,
            ui: d.Local.lab('weapon'),
            bbc: d.Lang.tr('x', '[color=red]火[/color]{#n}'),
        };
        d.Record.setting.lang = 'zh-TW';
        d.DB.load(d.game.scene.getScene('MainMenu'));
        r.back = d.DB.item('sword_01').lab;
        return r;
    });
    t.eq('qps 拉長加括號（DB.load 重跑不會疊兩層）', qps.item, '【匕首匕首】');
    t.eq('qps 角色名', qps.role, '【凱倫凱倫】');
    t.eq('qps local', qps.ui, '【武器武器】');
    t.eq('qps 只重複看得到的字', qps.bbc, '【[color=red]火[/color]{#n}火】');
    t.eq('切回原文', qps.back, '匕首');

    await t.newGame();
    t.ok('開新遊戲沒有錯誤');

    // 預期值是舊版字串拼接＋.replace(/，+/g,'，') 的結果，模板化後要一模一樣
    const eff = await t.eval(async d => {
        const {default:U} = await import('/src/core/utility.js');
        return {
            dot: U.fmt_Eff({type:'dot', stage:'hit', scope:'target', id:'burn', a:-5, dur:3, stack:3}),
            buffNoKey: U.fmt_Eff({type:'buff', id:'stun', dur:2}),
            buffKey: U.fmt_Eff({type:'buff', id:'stun', key:'str', a:2, dur:2}),
            mod: U.fmt_Eff({type:'mod', key:'str', a:1}),
            active: U.fmt_Active({type:'buff', key:'str', a:2}),
            activeId: U.fmt_Active({type:'debuff', id:'stun'}),
        };
    });
    t.eq('dot 效果句', eff.dot, '命中時，[color=white]目標[/color]觸發[color=skyblue]灼燒[/color]，每回合[color=red]-5[/color]血量，持續[color=white]3[/color]回合，最多疊加[color=white]3[/color]層');
    t.eq('buff 沒 key 不會出現兩個逗號', eff.buffNoKey, '觸發[color=skyblue]昏眩[/color]，持續[color=white]2[/color]回合');
    t.eq('buff 有 key', eff.buffKey, '觸發[color=skyblue]昏眩[/color]，力量[color=lime]+2[/color]，持續[color=white]2[/color]回合');
    t.eq('mod 效果句', eff.mod, '力量[color=lime]+1[/color]');
    t.eq('作用中 buff', eff.active, '有效回合內，力量[color=lime]+2[/color]');
    t.eq('作用中 debuff', eff.activeId, '有效回合內，昏眩');

    const msg = await t.eval(d => ({
        lock: '_lock_fail'.lab({who:d.GM.player.label}),
        noName: d.Local.name('no_such_key'),
        rogue: d.DB.role('rogue-1').lab,
        job: 'rogue'.lab(),
        des: d.objs().find(g => g.id === 'karen').des,
    }));
    t.eq('訊息模板帶名字', msg.lock, '維克 開鎖失敗');
    t.eq('Local.name 查不到顯示原樣', msg.noName, 'no_such_key');
    t.eq('盜賊有名字', msg.rogue, '盜賊');
    t.eq('職業 rogue 還在 local', msg.job, '盜賊');
    t.check('角色說明來自 role.json', msg.des.startsWith('每天從村外'), msg.des);
    t.eq('多行模板', await t.eval(() => '_lock_confirm'.lab({rate:40})), '用開鎖工具開鎖？\n成功率 40%');

    // 假的翻譯表：驗證對話節點、選項、_shared 後備、storylet、日誌都有帶到情境
    await t.eval(d => {
        d.Record.setting.lang = 'en';
        d.Lang.load({
            'dlg._common.n_cold': {'……又是你。': '...You again.'},
            'story.let.hunt_ask': {'關於任務': 'About the job'},
            'story.thread.bandit_hunt': {'盜賊討伐': 'Bandit Hunt', '與 xi 對話了解情況': 'Talk to xi'},
            _shared: {'離開': 'Leave', '聊天': 'Chat'},
        });
    });
    await t.setQ('karen.favor', 20);
    const cold = await t.talk('karen');
    t.eq('節點台詞照 dlg._common 情境翻', cold[0], '...You again.');
    const coldOpts = await t.eval(d => {d.objs().find(g => g.id === 'karen').talk(); const dlg = d.Ui.get(d.UI.TAG.DIALOG); const b = dlg.dialog.B.map(b => b.text); dlg.close(); return b;});
    t.check('選項走 _shared 後備', coldOpts.includes('Leave'), JSON.stringify(coldOpts));
    await t.setQ('karen.favor', 50);
    const opts = await t.eval(d => {d.objs().find(g => g.id === 'karen').talk(); const dlg = d.Ui.get(d.UI.TAG.DIALOG); const b = dlg.dialog.B.map(b => b.text); dlg.close(); return b;});
    t.check('storylet 選項照 story.let 情境翻', opts.includes('About the job') && opts.includes('Chat'), JSON.stringify(opts));
    t.check('沒有譯文的選項退回原文', opts.includes('交易'), JSON.stringify(opts));
    await t.talk('karen', 'About the job', '接受');
    const j = await t.journal('bandit_hunt');
    t.eq('日誌標題', j?.title, 'Bandit Hunt');
    t.eq('日誌內容', j?.lines[0]?.text, 'Talk to xi');

    await t.eval(d => {d.Record.setting.lang = 'qps'; d.Lang.load();});
    const q = await t.talk('karen');
    t.check('qps 對話台詞有括號', q[0].startsWith('【'), q[0]);
    t.check('qps 日誌有括號', (await t.journal('bandit_hunt')).title.startsWith('【'), '');
    await t.eval(d => {d.Record.setting.lang = 'zh-TW'; d.Lang.load();});

    // 真的翻譯檔：存設定 → 重新載入頁面 → Preloader 讀 lang/en.json
    await t.eval(d => {d.Record.setting.lang = 'en'; d.Record.saveSetting();});
    await t.page.reload();
    await t.waitFor(d => d?.game.scene.isActive('MainMenu'), {what:'主選單（英文）'});
    const en = await t.eval(d => ({item: d.DB.item('sword_01').lab, role: d.DB.role('karen').lab, ui: d.Local.lab('weapon'), font: d.GM.FONT, shared: d.Lang.tr('item.apple', '可食用')}));
    t.eq('en.json 的 item 譯文', en.item, 'Dagger');
    t.eq('en.json 的 role 譯文', en.role, 'Gilly');
    t.eq('en.json 的 ui 譯文', en.ui, 'Weapon');
    t.eq('en 字型來自 _meta.font', en.font, 'Arial, sans-serif');
    t.eq('情境沒譯文走 _shared', en.shared, 'Edible');

    await t.newGame();
    const enTalk = await t.talk('karen');
    t.check('英文對話', /^[\x00-\x7f~]+$/.test(enTalk[0]), enTalk[0]);
    t.eq('預設語言：中文系統', await t.eval(d => d.Record.defaultLang('zh-HK')), 'zh-TW');
    t.eq('預設語言：其他系統', await t.eval(d => d.Record.defaultLang('ja-JP')), 'en');
    await t.eval(d => {d.Record.setting.lang = 'zh-TW'; d.Record.saveSetting();});
});
