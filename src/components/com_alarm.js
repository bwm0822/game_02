import Com from './com.js'
import {GM} from '../core/setting.js'
import {T,dlog} from '../core/debug.js'

const RANGE = 8;            // 呼救/目擊範圍(格)
const WITNESS_FAV = -45;    // 目擊玩家攻擊人類時扣的好感度
const SHOUTS = ['救命啊！', '來人啊！', '有人要殺我！'];
const BUSY = ['ATTACK', 'FLEE', 'INVESTIGATE'];

const inRange = (source, target) => {
    const sb = source.senseBB(RANGE);
    const tb = target.gridBB;
    return Math.abs(sb.x - tb.x) < sb.hw + tb.hw &&
            Math.abs(sb.y - tb.y) < sb.hh + tb.hh;
}

const _tag = 'alarm';
//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : alarm
// 功能 :
//  1. 被玩家攻擊時通知附近目擊者(扣好感度)
//  2. 不在戰鬥中被攻擊時呼救，附近的人跑來查看(bb.alarmPos)
//--------------------------------------------------
export class COM_Alarm extends Com
{
    get tag() {return _tag;}   // 回傳元件的標籤
    get scene() {return this._root.scene;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _underAtk(attackerId)
    {
        const {root,bb,fav} = this.ctx;
        if(attackerId !== GM.player?.id) {return;}
        if(fav() <= GM.FAV.HATE) {return;}     // 正當防衛

        const others = this.scene.roles.filter(r=>r!==root);
        others.forEach(r=>r.witness?.());

        if(bb.beh && bb.beh !== 'SCHEDULE') {return;}
        root.speak?.(SHOUTS[Math.floor(Math.random()*SHOUTS.length)], {duration:1500});
        others.forEach(r=>r.hearAlarm?.(root));
    }

    _witness()
    {
        const {root,bb} = this.ctx;
        const player = GM.player;
        if(!root.isAlive || bb.sta===GM.ST.SLEEP) {return;}
        if(!inRange(root, player) || !root.canSee?.(player)) {return;}
        root.addFavor?.(player.id, WITNESS_FAV);
        dlog(T.AI,bb.id)('[ALARM] witness, fav=', root.getFavor?.(player.id));
    }

    _hearAlarm(src)
    {
        const {root,bb} = this.ctx;
        if(!root.isAlive || BUSY.includes(bb.beh)) {return;}
        if(!inRange(root, src)) {return;}
        if(bb.sta===GM.ST.SLEEP) {root.wake?.();}
        bb.alarmPos = {x:src.x, y:src.y};
        root.pop?.('❗');
        dlog(T.AI,bb.id)('[ALARM] hear alarm from', src.id);
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 0. bb
        this.ctx.bb.alarmPos = null;

        // 1.提供 [外部操作的指令]
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.witness = this._witness.bind(this);
        root.hearAlarm = this._hearAlarm.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.EVT.UNDERATK, this._underAtk.bind(this));
    }
}
