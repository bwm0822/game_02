import Behavior from './behavior.js'
import {GM} from '../../core/setting.js'
import {T,dlog} from '../../core/debug.js'

// --- 具體行為：追蹤到最後已知位置 ---

export class BehInvestigate extends Behavior
{
    constructor(opts={}) { super('INVESTIGATE', { minInterval: opts.minInterval ?? 1, ...opts }); }

    score(ctx)
    {
        const {bb} = ctx;
        if (bb.sensePlayer) return [0, 'has target'];
        if (!bb.lastKnownPos) return [0, 'no last known pos'];
        return [this.weight, 'to last known pos'];
    }

    async act(ctx)
    {
        const {bb, root} = ctx;
        const pos = bb.lastKnownPos;
        if (!pos) return { ok: false, note: 'no pos' };

        root.findPath?.({ep: pos});
        if (bb.path?.state === GM.PATH.NONE) { return this._giveUp(ctx, 'unreachable'); }

        await root.move?.();

        if (bb.cACT.st === 'reach') { return this._giveUp(ctx, 'reached last known pos'); }
        if (bb.cACT.st === 'blocked' && await this._onBlocked(ctx)) { return this._giveUp(ctx, 'blocked by door'); }

        this._commitUse(ctx);
        return { ok: true, note: 'investigate' };
    }

    _giveUp(ctx, why)
    {
        const {bb, root} = ctx;
        bb.lastKnownPos = null;
        root.clearPath?.();
        dlog(T.AI, bb.id)(`[INVESTIGATE] ${why}, giving up`);
        this._commitUse(ctx);
        return { ok: true, note: `investigate: ${why}` };
    }
}
