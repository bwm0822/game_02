import Com from './com.js'
import {GM} from '../core/setting.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : cmd
// 功能 : 提供外界對Role下指令的功能
//--------------------------------------------------
export class COM_Cmd extends Com
{
    get tag() {return 'cmd';}   // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _cmd({pt, ent, act, path}={})
    {
        const {root,bb} = this.ctx;

        if(!root.isAlive) {return;}

        if(bb.sta===GM.ST.ABILITY)
        {
            root.useAbility(ent);
        }
        else
        {
            bb.ent = ent;
            bb.act = act??ent?.act;
            if(path) { root.setPath?.(path); }
            else { root.findPath?.(pt??ent.pos); }
            root.updatePath?.();
            bb.sta=GM.ST.MOVING;
            root._resume();
        }
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.cmd = this._cmd.bind(this);
        
        // 3.註冊(event)給其他元件或外部呼叫
    }
}