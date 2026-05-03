import Com from './com.js'
import {GM} from '../core/setting.js'
import Utility from '../core/utility.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : stolen
// 功能 : 
//  可被偷竊
//--------------------------------------------------

export class COM_Stolen extends Com
{
    constructor()
    {
        super();
    }

    get tag() {return 'stolen';}  // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _stolenBy(target)
    {
        const {send} = this.ctx;

        // this.root 是 被竊者
        this.root.info = {act:GM.STEAL, type:GM.VICTIM, target:target}
        // target 是 thief
        target.info = {act:GM.STEAL, type:GM.THIEF, target:this.root}

        send('trade',this.root);    // 開啟 交易UI
    }

    _stolen(ent)
    {
        const {send,emit} = this.ctx;
        const chance=this._stolenRate(ent);
        const thief=this.root.info.target;
        if(Utility.roll(chance))    // 成功
        {
            send('msg',`${thief.id} 成功偷竊 ${ent.label}`);
            this.root?.transfer(ent);
            return true;
        }
        else
        {
            send('msg',`${thief.id} 偷竊失敗`);
            emit(GM.EVT.STOLEN, thief.id);
            thief.next();
            return false;
        }
    }

    _stopSteal()
    {
        this.root.info.target={};
        this.root.info={};
    }

    _actMode() {return GM.EN;}

    // 偷竊成功率
    _stolenRate(ent)
    {
        const dex1=this.root.total.dex;
        const dex2=this.root.info.target.total.dex;
        const p=Math.floor(dex2/dex1*50);
        return p;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        super.bind(root);

        // 1.提供 [外部操作的指令]
        root._setAct(GM.STEAL, this._actMode.bind(this));

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.stopSteal = this._stopSteal.bind(this);
        root.stolen = this._stolen.bind(this);
        root.stolenRate = this._stolenRate.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.STEAL, this._stolenBy.bind(this));
    }
}