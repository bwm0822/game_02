import Com from './com.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import QuestManager from '../manager/quest.js'
import Record from '../infra/record.js'
const _tag = 'talk_v2';

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

    _canAct()
    {
        const {bb, fav} = this.ctx;
        if (!this._data) return GM.HIDE;
        if (fav() <= GM.FAV.DISLIKE) return GM.HIDE;
        if (bb.sta === GM.ST.SLEEP) return GM.DIS;
        return GM.EN;
    }

    _matchCond(cond)
    {
        if (!cond) return true;
        const {type, flag} = cond;
        const val = this._rec[flag];
        return type === 'hasFlag' ? !!val : !val;
    }

    _getEntryNode()
    {
        if (!this._data?.entries) return null;
        const sorted = [...this._data.entries].sort((a, b) => a.order - b.order);
        const entry = sorted.find(e => this._matchCond(e.condition));
        return entry?.nodeId || null;
    }

    _getNode(nodeId = this._nodeId)
    {
        if (!nodeId || !this._data?.nodes) return null;
        return this._data.nodes[nodeId] || null;
    }

    _applyEffect(node)
    {
        if (node?.effect?.setFlag) {
            this._rec[node.effect.setFlag] = true;
        }
    }

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

    _onTalk()
    {
        this._nodeId = null;
        this.ctx.send('talk', this.root);
    }

    _onSelect(choice, cb)
    {
        if (choice.action === 'openShop') 
        {
            this.ctx.emit('trade', GM.player);
            cb?.('next');
            return;
        } 
        else if (choice.action === 'close') 
        {
            cb?.('exit');
            return;
        }

        if (choice.next) {
            this._nodeId = choice.next;
        }
        cb?.('next');
    }

    _onGetDialog()
    {
        if (!this._nodeId) {
            this._nodeId = this._getEntryNode();
            if (!this._nodeId) return {A: '', B: []};
        }

        const node = this._getNode();
        if (!node) return {A: '', B: []};

        this._applyEffect(node);

        const A = (node.textKeys || []).join('\n');
        const B = (node.choices || []).map(c => ({
            text: c.labelKey,
            action: c.action || null,
            next: c.next || null
        }));

        return {A, B};
    }

    _onDead()
    {
        this.root._delAct(GM.TALK);
    }

    bind(root)
    {
        super.bind(root);

        this._data = DB.dialog_v2(this.ctx.bb.id) || {};

        root._setAct(GM.TALK, this._canAct.bind(this));
        root.talk = this._onTalk.bind(this);
        root.select = this._onSelect.bind(this);
        root.getDialog = this._onGetDialog.bind(this);

        root.on(GM.TALK, this._onTalk.bind(this));
        root.on(GM.EVT.ONDEAD, this._onDead.bind(this));
    }

    load(data)
    {
        if(data?.[_tag]) Object.assign(this._rec, data[_tag]);
    }

    save()
    {
        return {[_tag]: this._rec};
    }
}
