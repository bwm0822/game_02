import Com from './com.js'
import DB from '../db.js'
import {GM} from '../setting.js'
import QuestManager from '../quest.js'
import {getPlayer} from '../roles/player.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : talk
// 功能 : 
//  交談
//--------------------------------------------------

export class COM_Talk extends Com
{
    constructor()
    {
        super();
        this._rec={};
    }

    get tag() {return 'talk';}  // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _talk()
    {
        const{send} = this.ctx;
        this._idx = this._rec.idx ?? 0;
        send('talk', this.root); // 開啟 對話UI
    }

    _select(option, cb)
    {
        const [text,args] = option.split('/').map(s => s.trim());
        // console.log(text,args)
        const cmds = args.split(';').map(s => s.trim());
        cmds.forEach(cmd=>{
            let [op,p1,p2]=cmd.split(' ');
            // console.log('op=',op)
            switch(op)
            {
                case 'next': 
                case 'exit': cb?.(op); break;
                case 'trade': this._trade(); cb?.('exit'); break;
                case 'goto': this._goto(p1); cb?.(op); break;
                case 'quest': this._quest(p1); cb?.('exit'); break;
                case 'close': this._close_quest(p1); break;
                case 'set': this._set(p1,p2); break;
            }
        })
    }

    _getDialog()
    {
        const idx = this._idx;
        let dialog = this._dialog[idx];
        if(dialog.type==='quest')
        {
            const sta = QuestManager.query(idx);
            console.log('dialog=',sta.state)
            return dialog[sta?.state??'start'];
        }
        return dialog;
    }

    _goto(p1)
    {
        let m = p1.match(/\[([^\]]+)\]/);   //取出[]內的字串
        if(m)   // 有[]，取出變數值
        {
            let [p,def] = m[1].split('=');
            this._idx = this._rec[p]??def;
        }
        else
        {
            this._idx = p1;
        }
    }

    _trade()
    {
        const {emit}=this.ctx;
        emit('trade', getPlayer())  // trade.js
    }

    _quest(p1)
    {
        QuestManager.add(p1);
        this._set('quest', p1);
    }

    _close_quest(p1)
    {
        const {send}=this.ctx;
        
        send('msg', '任務完成！');
        QuestManager.close(p1);
    }

    _set(key, value)
    {
        this._rec[key]=value;
    }
    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        super.bind(root);
        // act
        root._setAct(GM.TALK, true);
        // init
        const {bb} = this.ctx;
        this._dialog = DB.dialog(bb.id);

        // this.addP(root, 'dialog', {getter:this.get_dialog.bind(this)});
        root.talk = this._talk.bind(this);
        root.select = this._select.bind(this);
        root.getDialog = this._getDialog.bind(this);

        // 註冊 event
        root.on(GM.TALK, this._talk.bind(this));
    }

    load(data) 
    {
        if(data?.talk) {Object.assign(this._rec, data.talk);}
    }

    save() {return {talk:this._rec};}
}