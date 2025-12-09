import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../setting.js'
import InventoryService from '../services/inventoryService.js'
import UiObserve from './uiobserve.js'
import UiInv from './uiinv.js'
import UiProfile from './uiprofile.js'
// import {UiCount} from '../ui.js'
 import UiCount from '../ui/uicount.js'


export default class UiOption extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        const config=
        {
            x: 0,
            y: 0,
            orientation:'y',
            space: 5,
            cover: true,
        }
        super(scene, config, UI.TAG.OPTION);
        UiOption.instance = this;

        this._items = {};

        this.addBg(scene,{color:GM.COLOR_DARK,strokeColor:GM.COLOR_GRAY,strokeWidth:3})
            .addItem(GM.TALK)
            .addItem(GM.TRADE)
            .addItem(GM.OBSERVE, this.observe.bind(this))
            .addItem(GM.ATTACK)
            .addItem(GM.PICKUP)
            .addItem(GM.OPEN)
            .addItem(GM.ENTER)
            .addItem(GM.OPEN_DOOR)
            .addItem(GM.CLOSE_DOOR)
            .addItem(GM.INV, this.inv.bind(this))
            .addItem(GM.PROFILE, this.profile.bind(this))
            .addItem(GM.COOK)
            .addItem(GM.DRINK)
            .addItem(GM.FILL)
            .addItem(GM.REST)
            .addItem(GM.WAKE)
            // for slot
            .addItem(GM.BUY, this.trade.bind(this))
            .addItem(GM.SELL, this.trade.bind(this))
            .addItem(GM.TRANSFER, this.transfer.bind(this))
            .addItem(GM.USE, this.use.bind(this))
            .addItem(GM.DROP, this.drop.bind(this))
            .addItem(GM.SPLIT, this.split.bind(this))
            .addItem(GM.OPENBAG, this.openbag.bind(this))
            .setOrigin(0)
            .layout()
            .hide();
    }

    get owner() {return this.ent.owner;}
    get target() {return this.ent.owner.target;}

    addItem(key, ondown)
    {
        const scene = this.scene;
        const item = ui.uButton.call(this,scene,{
                        style: UI.BTN.OPTION,
                        text: key.lab(),
                        ondown: ()=>{(ondown??this.act.bind(this))(key);},
                        ext:{expand:true}, 
                    })
        this._items[key] = item;
        return this;
    }

    use()
    {
        this.close();
        this.owner.use(this.ent);
        this.refreshAll();
    }

    drop()
    {
        this.close();
        this.owner.drop(this.ent);
        this.ent.empty();
        this.refreshAll();
    }

    transfer()
    {
        this.close();
        if(this.owner.transfer(this.ent))
        {
            // this.ent.empty();
            this.refreshAll();
        }
    }

    trade()
    {
        this.close();
        if(this.owner.sell(this.ent))
        {
            this.ent.empty();
            this.refreshAll();
        }
    }

    observe()
    {
        this.close();
        UiObserve.show(this.ent);
    }

    inv()
    {
        this.close();
        UiInv.show(this.player);
    }

    profile()
    {
        this.close();
        UiProfile.show(this.player);
    }

    async split()
    {
        this.close();
        console.log('split',this.ent);
        let cnt = await UiCount.getCount(1, this.ent.content.count-1)
        // if(cnt==0) {return;}
        // this.owner.split(this.ent,cnt);
        // this.refreshAll();

        if (cnt==0) {return;}
        const ok = InventoryService.split(this.ent, cnt);
        if (ok) this.refreshAll();
    }

    openbag()
    {
        this.close();        
        UiStorage.show(this.ent, ~GM.CAT_BAG);
        this.ent.setEnable(false);
    }

    act(key)
    {
        this.close();
        this.player.execute({ent:this.ent,act:key});
    }

    rePos()
    {
        if(this.right>GM.w) {this.x-=this.right-GM.w;}
        else if(this.left<0) {this.x-=this.left;}
        if(this.bottom>GM.h) {this.y-=this.bottom-GM.h;}
        else if(this.top<0) {this.y-=this.top;}
        return this;
    }


    show(x,y,options,ent)
    {
        super.show();
        
        //
        this.ent = ent;
        
        // 設定 options
        Object.values(this._items).forEach((item)=>{item.hide();})
        Object.entries(options).forEach(([key,val])=>{
            this._items[key].show().setEnable(val);
        })

        // 設定位置，注意要在 layout() 之後再 setPosition()，否則會有 offset 的問題
        this.layout()
            .setPosition(x,y)
            .rePos() 
    }

    static show(x,y,options,ent) {this.instance.show?.(x,y,options,ent);}
}




// export default class UiOption_1 extends ContainerLite
// {
//     constructor(scene, layername)
//     {
//         super(scene);        
//         if(layername) {Ui.addLayer(scene, layername, this);}
//         else {scene.add.existing(this);}

//         const config =
//         {
//             x: GM.w/2,
//             y: GM.h/2,
//             width: GM.w,
//             height: GM.h,
//             color: GM.COLOR_RED,
//             alpha: 0.1,
//             interactive: true,
//             ondown: ()=>{console.log('down')}
//         }

//         const bg = ui.uRect(scene, config)
//         this.add(bg)
//         this.createPanel(scene);
//         this.visible=false;
//     }

//     createPanel(scene)
//     {
//         const config=
//         {
//             x: 500,
//             y: 500,
//             width: 150,
//             height: 150,
//             orientation:'y',
//             color: GM.COLOR_WHITE,
//         }

//         const p = ui.uPanel.call(this,scene,config);

//         ui.uItem.call(p,scene,{text:'123',ext:{expand:true}});
//         ui.uItem.call(p,scene,{text:'456',ext:{expand:true}});
//         p.layout();

//     }




// }