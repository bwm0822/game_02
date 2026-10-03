import {GM} from '../core/setting.js'
import {ItemView} from '../components/view.js'
import {COM_Storage} from '../components/com_inventory.js'
import {GameObject} from '../core/gameobject.js'
import TimeSystem from '../systems/time.js'
import Utility from '../core/utility.js'

const LIFE = 1440;  // 壽命(遊戲分鐘)，只在進場景重建時檢查

// 屍體消失後留在原地的遺物袋
export default class Remains extends GameObject
{
    get occludeType() {return GM.OCCLUDE.DROP;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _isEmpty() {return this.storage.items.every(itm=>Utility.isEmpty(itm)||itm.count<=0);}

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    init_runtime(data)
    {
        const now = TimeSystem.toTotalMinutes(TimeSystem.time);
        this._born = data.born ?? now;
        if(now-this._born >= LIFE) {this.destroy(); return;}

        if(!super.init_prefab()) {return;}

        this.bb.interactive = true;
        this.bb.weight = 0;
        this.bb.wid = GM.TILE_W;
        this.bb.hei = GM.TILE_H;
        this.bb.key = 'icons';
        this.bb.frame = '198';
        this.bb.keepRatio = true;

        // 加入元件
        this.addCom( new ItemView(this.scene), {modify:false} )
            .addCom( new COM_Storage() )

        // 載入
        this.load(data);

        // 拿空了就消失
        const close = this.close;
        this.close = ()=>{
            close();
            if(this._isEmpty()) {this._remove();}
        };

        return this;
    }

    save() {super.save({class:'remains', ...this.pos, born:this._born});}
}
