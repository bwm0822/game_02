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
        this._textIndexes = {};
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

    // 評估條件表達式（支援 "flag==value"、"!flag" 等格式）
    _matchCond(cond)
    {
        if (!cond || cond === '') return true;

        if (typeof cond === 'string') {
            return this._evalCond(cond);
        }

        const {type, flag} = cond;
        const val = this._rec[flag];
        return type === 'hasFlag' ? !!val : !val;
    }

    // 評估字符串條件表達式（支援 &&、||、==、!=）
    _evalCond(expr)
    {
        if (!expr || expr === '') return true;

        expr = expr.trim();

        // 特殊值：true/false 字面值
        if (expr === 'true') return true;
        if (expr === 'false') return false;

        // 處理 OR (||) - 若存在多個則任一為真即返回真
        if (expr.includes('||')) {
            return expr.split('||').some(e => this._evalCond(e.trim()));
        }

        // 處理 AND (&&) - 若存在多個則全部為真才返回真
        if (expr.includes('&&')) {
            return expr.split('&&').every(e => this._evalCond(e.trim()));
        }

        // 處理 NOT (!)
        if (expr.startsWith('!')) {
            const flag = expr.substring(1).trim();
            return !this._rec[flag];
        }

        // 處理不相等 (!=)
        if (expr.includes('!=')) {
            const [flag, value] = expr.split('!=').map(s => s.trim());
            const recVal = this._rec[flag];
            if (value === 'true') return recVal !== true;
            if (value === 'false') return recVal !== false;
            return recVal != value;
        }

        // 處理相等 (==)
        if (expr.includes('==')) {
            const [flag, value] = expr.split('==').map(s => s.trim());
            const recVal = this._rec[flag];
            if (value === 'true') return recVal === true;
            if (value === 'false') return recVal === false;
            return recVal == value;
        }

        // 簡單 flag 名稱 - 檢查是否為真
        return !!this._rec[expr];
    }

    // 取得初始入口節點（按 order 排序，找第一個符合條件的）
    _getEntryNode()
    {
        // 應用全局效果（設置旗標）
        if (this._data?.effects) {this._applyEffects(this._data.effects);}
        if (!this._data?.entries) return null;
        const sorted = [...this._data.entries].sort((a, b) => a.order - b.order);
        const entry = sorted.find(e => this._matchCond(e.condition));
        // 應用入口效果（設置旗標）
        if (entry?.effect) {this._applyEffect(entry.effect);}
        
        return entry?.nodeId || null;
    }

    // 取得指定節點的資料
    _getNode(nodeId = this._nodeId)
    {
        if (!nodeId || !this._data?.nodes) return null;
        const node = this._data.nodes[nodeId] || null;

        // 應用節點效果（設置旗標）
        this._applyEffect(node?.effect);

        return node;
    }

    // 應用節點效果（設置旗標或執行表達式）
    _applyEffects(effects)
    {
        if (!effects) return;
        effects.forEach(effect => this._applyEffect(effect));  
    }

    _applyEffect(effect)
    {
        if (!effect) return;

        // Handle string effect: treat as setFlag directly
        if (typeof effect === 'string') {
            this._setFlags(effect);
            return;
        }

        // Handle object effect: check condition first, then apply setFlag
        const [condition, setFlag]=Object.entries(effect)[0]
        if (condition && !this._matchCond(condition)) return;
        if (setFlag) {this._setFlags(setFlag);}
    }

    _setFlags(setFlag)
    {
        if (!setFlag || typeof setFlag !== 'string') return;

        const flags = setFlag.split(';').map(f => f.trim()).filter(f => f);
        for (const flag of flags) {
            if (flag.includes('=')) {
                const [name, value] = flag.split('=').map(s => s.trim());
                if (value === 'true') this._rec[name] = true;
                else if (value === 'false') this._rec[name] = false;
                else this._rec[name] = value;
            } else {
                this._rec[flag] = true;
            }
        }
    }

    // 第一次隨機選擇，之後依序顯示
    _pickText(text)
    {
        const options = text.split(';').map(t => t.trim()).filter(t => t);
        if (options.length <= 1) return text;

        const key = text;
        if (!(key in this._textIndexes)) {
            this._textIndexes[key] = Math.floor(Math.random() * options.length);
        }

        const idx = this._textIndexes[key];
        const result = options[idx];
        this._textIndexes[key] = (idx + 1) % options.length;

        return result || text;
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
            case 'goto': this._nodeId = this._getNext(p1); cb?.(op); break;
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
        // 應用選項效果（設置旗標）
        this._applyEffect(choice.effect);

        // 執行選項動作（trade, quest, close, set 等）
        if(choice.action)
        {
            switch(choice.action) 
            {
                case 'trade':
                    this.ctx.emit('trade', GM.player);
                    cb?.('exit');
                    break;
                case 'quest':
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

        // 導航到下一節點（若有指定）
        if (choice.next)
        {
            this._nodeId = this._getNext(choice.next);
            cb?.('goto');
        }
    }

    _getNext(next)
    {
        if (next && next.startsWith('#')) {
            const varName = next.substring(1);
            return this._rec[varName];
        }
        return next;
    }

    // 取得對話內容（文本 + 選項）
    _onGetDialog()
    {
        // 取得當前節點ID，若不存在則尋找入口節點
        if (!this._nodeId)
        {
            this._nodeId = this._getEntryNode();
            if (!this._nodeId) return {A: '', B: []};
        }

        // 取得當前節點
        const node = this._getNode();
        if (!node) return {A: '', B: []};

        // 取得文本與選項
        const A = this._getNodeText(node);
        const B = (node.choices || [])
            .filter(c => this._matchCond(c.condition))
            .map(c => ({
                text: c.labelKey,
                action: c.action || null,
                next: c.next || null,
                effect: c.effect || null
            }));

        // 應用後置效果（設置旗標）
        this._applyEffects(node.posts);

        // 返回對話內容
        return {A, B};
    }

    // 根據條件從 textKeys 選擇文本
    _getNodeText(node)
    {
        const textKeys = node.textKeys;
        if (!textKeys) return '';

        // 若 textKeys 是對象（條件映射）
        if (typeof textKeys === 'object' && !Array.isArray(textKeys)) {
            for (const [cond, text] of Object.entries(textKeys)) {
                if (this._matchCond(cond)) {
                    return this._pickText(text);
                }
            }
            return '';
        }

        // 若 textKeys 是數組（原始格式）
        if (Array.isArray(textKeys)) {
            return textKeys.map(t => this._pickText(t)).join('\n');
        }
        else
            return this._pickText(textKeys);

        return '';
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
