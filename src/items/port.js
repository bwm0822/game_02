import {GM} from '../core/setting.js'
import {GameObject} from '../core/gameobject.js'
import {ItemView} from '../components/view.js'
import {COM_Port} from '../components/com_port.js'

export default class Port extends GameObject
{
    get occludeType() {return GM.OCCLUDE.NONE;}

    init_prefab()
    {      
        if(!super.init_prefab()) {return;}

        this.bb.interactive = true;     // 設成 可互動，view 元件會參考
        this.bb.hasPhy = false;          // 是否有物理實體
        
        // 加入元件
        this.addCom( new ItemView(this.scene), {modify:true} )
            .addCom( new COM_Port() )

        // 載入
        this.load();

        // 提供給外界操作
        return true;
    }

    // 執行期動態建立(不是從 Tiled 物件層讀出來的)，例如地圖邊界的出口
    // icon 格式跟 Pickup 一樣是 "spritesheet:frame"(例如 "cursors:1")
    // 注意：bb 的 key 不能叫 pos，View._setData() 會把 bb 每個 key 硬塞進元件自己身上，
    // 元件本身有 pos 這個唯讀 getter，撞名會直接噴錯，所以這裡用 dest 代替
    // 刻意不呼叫 super.init_prefab()：這種出口每次 create() 都整批重新產生，
    // 不需要 _addToList() 登記進 scene.gos、也不需要存讀檔/移除機制
    init_runtime({icon, map, port, dest, ambient}={})
    {
        this.bb.interactive = true;
        this.bb.hasPhy = false;
        this.bb.map = map;
        this.bb.port = port;
        this.bb.dest = dest;
        this.bb.ambient = ambient;
        this.bb.wid = 32;
        this.bb.hei = 32;
        this.bb.keepRatio = true;
        this.bb.weight = 1;

        if(icon)
        {
            const [key,frame] = icon.split(':');
            this.bb.key = key;
            this.bb.frame = frame;
        }

        this.addCom( new ItemView(this.scene), {modify:true, depth:0, alpha:0.5} )
            .addCom( new COM_Port() )

        this.load();

        return this;
    }
}