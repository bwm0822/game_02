// 部位 pool（part.json）：node scripts/test/part.mjs
import {run} from './harness.mjs'

run('部位 pool', async t => {
    await t.waitFor(d => d?.game.scene.isActive('MainMenu'), {what:'主選單'});
    t.eq('role 寫 id、DB.rolePart 查 part.json', await t.eval(d => d.DB.rolePart(d.DB.role('wick'), 'head')?.sprite), 'head-wick');
    t.eq('查不到 id 不畫', await t.eval(d => d.DB.rolePart({head:'nope'}, 'head') ?? null), null);

    await t.newGame('mary');
    // 角色 view 畫出的 sprite key（RoleView 的 _shape）
    const keys = await t.eval(d => {
        const v = Object.values(d.GM.player._coms ?? {}).find(c => c?._shape?.getAll);
        return v ? v._shape.getAll().map(sp => sp.texture.key) : null;
    });
    t.check('瑪莉畫出身體／頭／頭髮／手', ['body-woman', 'head-mary', 'hair-mary', 'hand-man'].every(k => keys?.includes(k)), JSON.stringify(keys));
});
