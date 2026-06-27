import Com from './com.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import QuestManager from '../manager/quest.js'
import Record from '../infra/record.js'
const _tag = 'talk_v2';

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : talk_v2
// 功能 :
//  對話系統（支援 dialog_v2.json 格式）
//--------------------------------------------------

export class COM_Talk_V2 extends Com
{
    constructor()
    {
        super();
        this._rec = {};
        this._nodeId = null;
        this._data = null;
    }

    get tag() {return _tag;}

    //------------------------------------------------------
    //  私有方法
    //------------------------------------------------------
    // 檢查是否可以進行交談（好感度、睡眠狀態）
    _canAct()
    {
        const {bb, fav} = this.ctx;
        if (!this._data) return GM.HIDE;
        if (fav() <= GM.FAV.DISLIKE) return GM.HIDE;
        if (bb.sta === GM.ST.SLEEP) return GM.DIS;
        return GM.EN;
    }

    // 檢查條件是否符合（hasFlag / notFlag）
    _matchCond(cond)
    {
        if (!cond) return true;
        const {type, flag} = cond;
        const val = this._rec[flag];
        return type === 'hasFlag' ? !!val : !val;
    }

    // 取得初始入口節點（按 order 排序，找第一個符合條件的）
    _getEntryNode()
    {
        if (!this._data?.entries) return null;
        const sorted = [...this._data.entries].sort((a, b) => a.order - b.order);
        const entry = sorted.find(e => this._matchCond(e.condition));
        return entry?.nodeId || null;
    }

    // 取得指定節點的資料
    _getNode(nodeId = this._nodeId)
    {
        if (!nodeId || !this._data?.nodes) return null;
        return this._data.nodes[nodeId] || null;
    }

    // 應用節點效果（如設置旗標）
    _applyEffect(node)
    {
        if (node?.effect?.setFlag) {
            this._rec[node.effect.setFlag] = true;
        }
    }

    // 隨機選擇文本（若包含 ; 分割）
    _pickText(text)
    {
        const options = text.split(';').map(t => t.trim()).filter(t => t);
        return options[Math.floor(Math.random() * options.length)] || text;
    }

    // 執行對話指令（next, exit, trade, goto, quest, close, set 等）
    _execCmd(cmd, cb)
    {
        const [op, ...args] = cmd.trim().split(/\s+/);
        const [p1, p2] = args;

        switch(op) {
            case 'next':
            case 'exit': cb?.(op); break;
            case 'trade': this.ctx.emit('trade', GM.player); cb?.('exit'); break;
            case 'goto': this._nodeId = p1; cb?.(op); break;
            case 'quest': QuestManager.add(p1); this._rec.quest = p1; break;
            case 'close': this.ctx.send('msg', '任務完成！'); QuestManager.close(p1); break;
            case 'set': this._rec[p1] = p2; break;
            case 'sete': Record.setEntry(p1, p2); break;
            case 'add': Record.addOpt(p1, p2); break;
            case 'rm': Record.rmOpt(p1, p2); break;
        }
    }

    // 開始對話（重置節點，發送事件開啟對話UI）
    _onTalk()
    {
        this._nodeId = null;
        this.ctx.send('talk', this.root);
    }

    // 選擇選項（處理 action、導航節點）
    _onSelect(choice, cb)
    {
        if(choice.action)
        {
            switch(choice.action) 
            {
                case 'openShop':
                    this.ctx.emit('trade', GM.player);
                    cb?.('exit');
                    break;
                default:
                    cb?.(choice.action);
                    break;
                // case 'close':
                //     cb?.('exit');
                //     return;
                // case 'update':
                //     cb?.('update');
                //     return;
            }
        }

        if (choice.next) 
        {
            this._nodeId = choice.next;
            cb?.('goto');
        }
    }

    // 取得對話內容（文本 + 選項）
    _onGetDialog()
    {
        if (!this._nodeId)
        {
            this._nodeId = this._getEntryNode();
            if (!this._nodeId) return {A: '', B: []};
        }

        const node = this._getNode();
        if (!node) return {A: '', B: []};

        this._applyEffect(node);

        const A = (node.textKeys || []).map(t => this._pickText(t)).join('\n');
        const B = (node.choices || []).map(c => ({
            text: c.labelKey,
            action: c.action || null,
            next: c.next || null
        }));

        return {A, B};
    }

    // 角色死亡時清除交談行為
    _onDead()
    {
        this.root._delAct(GM.TALK);
    }

    //------------------------------------------------------
    //  公開方法
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 1.載入對話資料
        this._data = DB.dialog_v2(this.ctx.bb.id) || {};

        // 2.設定外部操作界面（方法 & 事件）
        root._setAct(GM.TALK, this._canAct.bind(this));
        root.talk = this._onTalk.bind(this);
        root.select = this._onSelect.bind(this);
        root.getDialog = this._onGetDialog.bind(this);

        root.on(GM.TALK, this._onTalk.bind(this));
        root.on(GM.EVT.ONDEAD, this._onDead.bind(this));
    }

    // 讀取存檔資料（運行時狀態）
    load(data)
    {
        if(data?.[_tag]) Object.assign(this._rec, data[_tag]);
    }

    // 保存運行時狀態
    save()
    {
        return {[_tag]: this._rec};
    }
}
