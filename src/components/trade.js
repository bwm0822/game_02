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

        this.root.info = {act:GM.TRADE, type:GM.SELLER, target};
        target.info = {act:GM.TRADE, type:GM.BUYER, target:this.root};
        send('trade',this.root);    // 開啟 交易UI
    }

    _stopTrade()
    {
        this.root.info.target.info={};
        this.root.info={};
    }

    _sell(ent, i, isEquip)
    {
        const {root,bb,send} = this.ctx;
        const target = root.info.target;

        if(target.gold>=ent.price)
        {
            const remain = target.receive(ent.content, i, isEquip);
            if(remain===ent.count)
            {
                send('msg','_space_full'.lab());
                return false;
            }
            else
            {
                const name = function(id) {return `[weight=900]${id.lab()}[/weight] `}
                const gold = ent.gold*(ent.count-remain);
                bb.gold += gold
                target.gold -= gold; 
                if(root===GM.player) {send('msg',name(bb.id)+`${'_sell'.lab()} ${ent.label}`);}
                else {send('msg',name(GM.player.id)+`${'_buy'.lab()} ${ent.label}`);}
                if(remain===0) {ent.empty();}
                else {ent.count=remain;}
                return true;
            }
        }
        else
        {
            send('msg','_not_enough_gold'.lab());
            return false;
        }
    }

    _actMode()
    {
        const {bb,fav} = this.ctx;
        return fav()<=GM.FAV.DISLIKE ? GM.HIDE  
                                    :  bb.sta===GM.ST.SLEEP ? GM.DIS
                                                            : GM.EN;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        super.bind(root);

        // init

        // 1.提供 [外部操作的指令]
        if(this._enableAct) {root._setAct(GM.TRADE, this._actMode.bind(this));}

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.trade = this._trade.bind(this);
        root.stopTrade = this._stopTrade.bind(this);
        root.sell = this._sell.bind(this);
        // root.buy = this._buy.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.TRADE, this._trade.bind(this));
    }
}