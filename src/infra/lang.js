import Record from './record.js';

//--------------------------------------------------
// 多國語言：設計見 docs/i18n-architecture.md
//  - 資料只存原文，key = 情境(ctx) + 原文(src)；查不到退回原文
//  - qps 是開發用偽語系：原文拉長並加【】，用來抓爆版與漏接 tr() 的字串
//--------------------------------------------------
export default class Lang
{
    static SOURCE = 'zh-TW';
    static PSEUDO = 'qps';
    static _tbl = null;

    static get code() {return Record.setting.lang;}

    static load(tbl) {this._tbl = tbl ?? null;}

    static tr(ctx, src, args)
    {
        if(typeof src !== 'string' || src === '') {return src;}
        let out = src;
        if(this.code === this.PSEUDO) {out = this._pseudo(src);}
        else if(this.code !== this.SOURCE && this._tbl)
        {
            out = this._tbl[ctx]?.[src] ?? this._tbl._shared?.[src] ?? src;
        }
        return args ? this.fill(out, args) : out;
    }

    static fill(str, args)
    {
        return str.replace(/{#(\w+)}/g, (m, k) => (k in args ? `${args[k]}` : m));
    }

    static _pseudo(src)
    {
        const visible = src.replace(/\[[^\]]*\]|{[^}]*}/g, '');
        return `【${src}${visible}】`;
    }
}

export const tr = Lang.tr.bind(Lang);
