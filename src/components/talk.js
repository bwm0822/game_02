import Com from './com.js'
import DB from '../db.js'
import {GM} from '../setting.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : talk
// 功能 : 
//  交談
//--------------------------------------------------

export class Talk extends Com
{
    get tag() {return 'talk';}  // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _talk()
    {
        const{send}=this.ctx;
        send('talk',this.root);
    }

    _getter() {return this._dialog[this._id];}

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
                case 'exit': 
                case 'trade': cb?.(op); break;
                case 'goto': this._goto(p1); cb?.(op); break;
                case 'quest': this._quest(p1); break;
                case 'close': this._close_quest(p1); break;
                case 'set': this._set(p1,p2); break;
            }
        })
    }

    _goto(p1)
    {
        let m = p1.match(/\[([^\]]+)\]/);   //取出[]內的字串
        if(m)
        {
            let [p,val] = m[1].split('=');
            if(this.owner.rec[p])
            {
                if(p==='quest')
                {
                    let q = QuestManager.query(this.owner.rec[p]);
                    if(q)
                    {
                        this._id = this.owner.rec[p]+'_'+q.state();
                    }
                    else
                    {
                        this._id = this.owner.rec[p];
                    }
                }
            }
            else
            {
                this._id = val;
            }
        }
        else
        {
            this._id = p1;
        }
    }

    _close_quest(q) {}
    _quest(q) {}
    _set(p1,p2) {}
    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        super.bind(root);

        // init
        const {bb} = this.ctx;
        this._dialog = DB.dialog(bb.id);
        this._id = 0;

        this.addP(root, 'dialog', {getter:this._getter.bind(this)});
        root.talk = this._talk.bind(this);
        root.select = this._select.bind(this);

        // 註冊 event
        root.on(GM.TALK, this._talk.bind(this));
    }
}