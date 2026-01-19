import Com from './com.js'
import {GM} from '../core/setting.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : trade
// 功能 : 
//  交易
//--------------------------------------------------

export class COM_Trade extends Com
{
    constructor(enableAct=true)
    {
        super();
        this._enableAct=enableAct;
    }

    get tag() {return 'trade';}  // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _trade(target)
    {
        const {send} = this.ctx;

        this.root.tradeType = GM.SELLER;
        this.root.target = target;
        this.root.target.tradeType = GM.BUYER;
        this.root.target.target = this.root;
        send('trade',this.root);    // 開啟 交易UI
    }

    _stopTrade()
    {
        delete this.root.target.tradeType;
        delete this.root.target.target;
        delete this.root.tradeType;
        delete this.root.target;
    }

    _sell(ent, i, isEquip)
    {
        const {bb} = this.ctx;
        if(this.root.target.buy(ent, i, isEquip))
        {
            bb.gold+=ent.gold;
            ent.empty();
            return true;
        }
        return false;
    }

    _buy(ent, i, isEquip)
    {
        const name = function(id) {return `[weight=900]${id.lab()}[/weight] `}

        const {bb,emit,send} = this.ctx;
        if(bb.gold>=ent.gold)
        {
            if(emit('take',ent.content, i, isEquip))
            {
                bb.gold-=ent.gold;
                if(this.root === GM)
                {
                    send('msg',name(bb.id)+`${'_buy'.lab()} ${ent.label}`);
                }
                else
                {
                    send('msg',name(GM.player.id)+`${'_sell'.lab()} ${ent.label}`)
                }
                return true;
            }
            return false;
        }
        else
        {
            send('msg','_not_enough_gold'.lab());
            return false;
        }
    }

    _actEnabled()
    {
        const {bb,fav} = this.ctx;
        return bb.sta!==GM.ST.SLEEP && fav()>GM.FAV.DISLIKE;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        super.bind(root);

        // init
        const en = this._actEnabled.bind(this);

        // 1.提供 [外部操作的指令]
        if(this._enableAct) {root._setAct(GM.TRADE, ()=>en());}

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.trade = this._trade.bind(this);
        root.stopTrade = this._stopTrade.bind(this);
        root.sell = this._sell.bind(this);
        root.buy = this._buy.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.TRADE, this._trade.bind(this));
    }
}