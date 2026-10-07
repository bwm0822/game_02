import Behavior from './behavior.js'
import {GM} from '../../core/setting.js'
import {T,dlog} from '../../core/debug.js'

// --- 具體行為：聽到呼救，跑去呼救地點查看 ---

export class BehRespond extends Behavior
{
    constructor(opts={}) { super('RESPOND', { minInterval: opts.minInterval ?? 1, ...opts }); }

    score(ctx)
    {
        const {bb} = ctx;
        if (!bb.alarmPos) return [0, 'no alarm'];
        return [this.weight, 'to alarm pos'];
    }

    async act(ctx)
    {
        const {bb, root} = ctx;

        root.findPath?.({ep: bb.alarmPos});
        if (bb.path?.state === GM.PATH.NONE) { return this._done(ctx, 'unreachable'); }

        await root.move?.();

        if (bb.cACT.st === 'reach') { return this._done(ctx, 'reached alarm pos'); }
        if (bb.cACT.st === 'blocked' && await this._onBlocked(ctx)) { return this._done(ctx, 'blocked by door'); }

        this._commitUse(ctx);
        return { ok: true, note: 'respond' };
    }

    _done(ctx, why)
    {
        const {bb, root} = ctx;
        bb.alarmPos = null;
        bb.idleCnt = 3;     // 到現場東張西望一下再回去做作息
        root.clearPath?.();
        dlog(T.AI, bb.id)(`[RESPOND] ${why}`);
        this._commitUse(ctx);
        return { ok: true, note: `respond: ${why}` };
    }
}
