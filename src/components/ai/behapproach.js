import Behavior from './behavior.js'
import Story from '../../systems/story.js'
import {GM,GS} from '../../core/setting.js'
import {T,dlog} from '../../core/debug.js'

// --- 具體行為：storylet 的 approach 指令，走到玩家旁邊、打開對話進入 bb.approach 節點 ---

export class BehApproach extends Behavior
{
    constructor(opts={}) { super('APPROACH', { minInterval: opts.minInterval ?? 1, ...opts }); }

    score(ctx)
    {
        const {bb, fav} = ctx;
        if (!bb.approach) return [0, 'no approach'];
        if (fav() <= GM.FAV.HATE) { bb.approach = null; return [0, 'hates player']; }
        if (GS.mode !== GM.MODE.NORMAL) return [0, 'combat'];
        if (bb.sta === GM.ST.SLEEP) return [0, 'sleeping'];
        if (Story.playerBusy) return [0, 'player busy'];
        return [this.weight, 'to player'];
    }

    async act(ctx)
    {
        const {bb, root} = ctx;
        const player = GM.player;

        root.findPath?.({ent: player});
        if (bb.path?.state === GM.PATH.NONE) { return this._done(ctx, 'unreachable'); }

        await root.move?.();

        if (bb.cACT.st === 'blocked' && await this._onBlocked(ctx)) { return this._done(ctx, 'blocked by door'); }
        if (bb.cACT.st !== 'reach') { this._commitUse(ctx); return { ok: true, note: 'approach' }; }

        const node = bb.approach;
        this._done(ctx, `talk ${node}`);
        root.face?.(player.pos);
        if (!root.talkAt?.(node)) { return { ok: false, note: 'approach: cannot talk' }; }
        player.stop();
        player.face?.(root.pos);
        bb.idleCnt = 2;     // 對話開著的那一回合別走開
        return { ok: true, note: 'approach: talk' };
    }

    _done(ctx, why)
    {
        const {bb, root} = ctx;
        bb.approach = null;
        root.clearPath?.();
        dlog(T.AI, bb.id)(`[APPROACH] ${why}`);
        this._commitUse(ctx);
        return { ok: true, note: `approach: ${why}` };
    }
}
