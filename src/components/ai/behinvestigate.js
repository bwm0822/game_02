import Behavior from './behavior.js'
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
        if (root.checkPath?.() === false) { root.findPath?.({ep: pos}); }

        await root.move?.();

        if (bb.cACT.st === 'reach')
        {
            bb.lastKnownPos = null;
            root.clearPath?.();
            dlog(T.AI, bb.id)('[INVESTIGATE] reached last known pos, giving up');
        }

        this._commitUse(ctx);
        return { ok: true, note: 'investigate' };
    }
}
