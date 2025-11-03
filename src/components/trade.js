import Com from './com.js'
import {GM} from '../setting.js'
import {getPlayer} from '../roles/player.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : trade
// 功能 : 
//  交易
//--------------------------------------------------

export class Trade extends Com
{
    get tag() {return 'trade';}  // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _trade(target)
    {
        const {send}=this.ctx;
        this._target = target;
        this.root.tradeType = GM.SELLER;
        target.tradeType = GM.BUYER;
        send('trade',this.root);
    }

    _stopTrade()
    {
        delete this.root.tradeType;
        delete this._target.tradeType;
    }

    _sell(target, ent, i, isEquip)
    {
        // console.log('sell', target, ent, i, isEquip);

        const {bb}=this.ctx;
        if(target.buy(ent, i, isEquip))
        {
            bb.gold+=ent.gold;
            ent.empty();
            return true;
        }
        return false;
    }

    _buy(ent, i, isEquip)
    {
        // console.log('buy',ent, i, isEquip);

        const name = function(id) {return `[weight=900]${id.lab()}[/weight] `}

        const {bb,emit,send}=this.ctx;
        if(bb.gold>=ent.gold)
        {
            if(emit('take',ent, i, isEquip))
            {
                bb.gold-=ent.gold;
                if(this.root === getPlayer())
                {
                    send('msg',name(bb.id)+`${'_buy'.lab()} ${ent.label}`);
                }
                else
                {
                    send('msg',name(getPlayer().id)+`${'_sell'.lab()} ${ent.label}`)
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

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        super.bind(root);

        // init
        const {bb} = this.ctx;
        root.trade = this._trade.bind(this);
        root.stopTrade = this._stopTrade.bind(this);
        root.sell = this._sell.bind(this);
        root.buy = this._buy.bind(this);


        // 註冊 event
        // root.on(GM.TALK, this._talk.bind(this));
    }
}