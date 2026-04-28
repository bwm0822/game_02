import Com from './com.js'
import {GM} from '../core/setting.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : trade
// 功能 : 
//  交易
//--------------------------------------------------

export class COM_Steal extends Com
{
    constructor()
    {
        super();
    }

    get tag() {return 'steal';}  // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _steal(target)
    {
        console.log('------ steal')

        const {send} = this.ctx;

        //
        this.root.tradeType = GM.SELLER;
        this.root.target = target;
        // target 是 player
        this.root.target.tradeType = GM.BUYER;
        this.root.target.target = this.root;
        send('trade',this.root);    // 開啟 交易UI
    }

    _stopSteal()
    {
        delete this.root.target.tradeType;
        delete this.root.target.target;
        delete this.root.tradeType;
        delete this.root.target;
    }

    _actMode() {return GM.EN;}

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        super.bind(root);

        // 1.提供 [外部操作的指令]
        root._setAct(GM.STEALING, this._actMode.bind(this));

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.steal = this._steal.bind(this);
        root.stopSteal = this._stopSteal.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.STEALING, this._steal.bind(this));
    }
}