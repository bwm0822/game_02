import Record from './record.js';
import {GM} from '../core/setting.js';
import {compile} from '../data/langdata.js';

const SOURCE_FONT = GM.FONT;

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

    // 原文語言跟偽語系不需要翻譯檔（public/assets/lang/<code>.json，手寫來源檔，格式見 src/data/langdata.js）
    static get needsTable() {return this.code !== this.SOURCE && this.code !== this.PSEUDO;}

    static load(file)
    {
        this._tbl = file ? compile(file) : null;
        GM.FONT = file?._meta?.font || SOURCE_FONT;
    }

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

    // 以 / 分段各自處理：對話的 / 隨機變體挑出來後每段都要有括號
    static _pseudo(src)
    {
        return src.split(/\/(?![^[\]]*\])/).map(part => {
            const visible = part.replace(/\[[^\]]*\]|{[^}]*}/g, '');
            return `【${part}${visible}】`;
        }).join('/');
    }
}

export const tr = Lang.tr.bind(Lang);
