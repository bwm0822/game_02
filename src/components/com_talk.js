import Com from './com.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import Story from '../systems/story.js'
import Line from '../systems/line.js'
import {exec, evalCond} from '../systems/script.js'
const _tag = 'talk';

// 沒有 storylets 列時，storylet 插進 entry 節點的 priority，見 docs/story-architecture.md §6.4
const CARD_PRIORITY = 30;

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : talk
// 功能 :
//  對話系統
//--------------------------------------------------

export class COM_Talk extends Com
{
    constructor()
    {
        super();
        this._nodeId = null;
        this._entryId = null;
        this._say = null;
        this._data = null;
        this._textIndexes = {};
    }

    get tag() {return _tag;}

    //------------------------------------------------------
    //  私有方法
    //------------------------------------------------------
    get _npc() {return this.ctx.bb.id;}
    get _sctx() {return {npc:this._npc, facts:Line.facts(this._npc, this.root)};}

    // 檢查是否可以進行交談（好感度、睡眠狀態）
    _canAct()
    {
        const {bb, fav} = this.ctx;
        if (!this._data) return GM.HIDE;
        if (fav() <= GM.FAV.HATE) return GM.HIDE;
        if (bb.sta === GM.ST.SLEEP) return GM.DIS;
        return GM.EN;
    }

    _matchCond(cond) {return evalCond(cond, this._sctx);}

    // 取得初始入口節點（按 order 排序，找第一個符合條件的）
    _getEntryNode()
    {
        if (!this._data?.entries) return null;
        const sorted = [...this._data.entries].sort((a, b) => a.order - b.order);
        const entry = sorted.find(e => this._matchCond(e.condition));
        // 應用入口效果（設置旗標）
        if (entry?.actions) {this._exec(entry.actions);}

        return entry?.nodeId || null;
    }

    // NPC 自己的 dialog 節點優先，沒有再找 story.xlsx 的長對話節點
    _findNode(nodeId) {return this._data?.nodes?.[nodeId] ?? Story.node(this._npc, nodeId) ?? null;}

    // 第一次隨機選擇，之後依序顯示
    _pickText(text)
    {
        const options = text.split('/').map(t => t.trim()).filter(t => t);
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

    // 執行對話指令；對話控制類(trade/close…)在這裡處理，其餘交給共用指令模組
    _exec(actions, cb)
    {
        exec(actions, {...this._sctx, cb:(op)=>{
            if(op === 'trade')
            {
                this.ctx.emit('trade', GM.player);
                cb?.('exit');
            }
            else {cb?.(op);}
        }});
    }

    // 開始對話（重置節點，發送事件開啟對話UI）
    _onTalk()
    {
        this._nodeId = null;
        this._entryId = null;
        this._say = null;
        this.ctx.send('talk', this.root);
    }

    // 選擇選項（處理 action、導航節點）
    _onSelect(choice, cb)
    {
        if (choice.card) {this._selectCard(choice, cb); return;}

        // 1. 執行選項動作
        if(choice.actions) {this._exec(choice.actions, cb);}

        // 2. 跳到到下一節點(若有指定)
        if (choice.next)
        {
            this._nodeId = choice.next;
            cb?.('goto');
        }
    }

    // 對話卡：套用 effects，text 是 @節點 就跳過去，否則把那句話當成 NPC 的回應、留在 entry 節點
    _selectCard({card, enabled}, cb)
    {
        if (!enabled) return;
        this._exec(card.effects, cb);
        if (card.text?.startsWith('@')) {this._nodeId = card.text.slice(1);}
        else {this._say = card.text ?? null;}
        cb?.('goto');
    }

    _cardChoices(priority, mood)
    {
        return Story.talkCards(this._npc, mood).map(({card, enabled}) => ({
            labelKey: card.label,
            priority,
            card, enabled,
        }));
    }

    // 節點沒有 choice 列、但有 next 時，沿用 next 節點的選項（連同插在那裡的對話卡）
    _choices(nodeId, node)
    {
        if (!node.choices?.length && node.next)
        {
            const src = this._findNode(node.next);
            if (src) {return this._choices(node.next, src);}
        }
        let choices = (node.choices || []).filter(c => this._matchCond(c.condition));
        const priority = node.cards ?? (nodeId === this._entryId ? CARD_PRIORITY : null);
        if (priority !== null)
        {
            choices = [...choices, ...this._cardChoices(priority, node.mood ?? '')].sort((a, b) => (a.priority || 0) - (b.priority || 0));
        }
        return choices;
    }

    // 取得對話內容（文本 + 選項）
    _onGetDialog()
    {
        // 取得當前節點ID，若不存在則尋找入口節點
        if (!this._nodeId)
        {
            this._nodeId = this._entryId = this._getEntryNode();
            if (!this._nodeId) return {A: '', B: []};
        }

        // 取得當前節點
        const node = this._findNode(this._nodeId);
        if (!node) return {A: '', B: []};

        // 對話卡的一句話回應：只換掉 NPC 的台詞，不重跑節點效果
        const say = this._say;
        this._say = null;
        if (!say) {this._exec(node.actions);}

        // 取得文本與選項
        const A = say ?? this._nodeText(node);
        const B = this._choices(this._nodeId, node).map(c => ({
            text: c.labelKey,
            actions: c.actions || null,
            next: c.next || null,
            card: c.card,
            enabled: c.enabled,
            hint: c.card?.hint,
        }));

        // 應用後置效果（設置旗標）
        if(!say && node.posts) {this._exec(node.posts);}

        // 返回對話內容
        return {A, B};
    }

    // entry 節點的 text_keys 空白時，開場白用 greet line
    _nodeText(node)
    {
        const text = this._getNodeText(node);
        if (text || this._nodeId !== this._entryId) {return text;}
        const greet = Line.pick(this._npc, 'greet', Line.facts(this._npc, this.root));
        return greet ? this._pickText(greet) : '';
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

        return this._pickText(textKeys);
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
        this._data = DB.dialog(this.ctx.bb.id);

        // 2.設定外部操作界面（方法 & 事件）
        root._setAct(GM.TALK, this._canAct.bind(this));
        root.talk = this._onTalk.bind(this);
        root.select = this._onSelect.bind(this);
        root.getDialog = this._onGetDialog.bind(this);

        root.on(GM.TALK, this._onTalk.bind(this));
        root.on(GM.EVT.ONDEAD, this._onDead.bind(this));
    }
}
