// JSON 文字框：透明 textarea 疊在上色的 <pre> 上，打字即時檢查（只把第一個出錯的 token 標紅，原因放 title）
// 寬鬆：裸 key、結尾多餘逗號不算錯，套用時用解析出來的值所以自然變標準 JSON
const WS = /\s+/y;
const STR = /"((?:[^"\\\n]|\\.)*)("?)/y;
const NUM = /-?(?:[eE][+-]|[\w.])*/y;
const NUM_OK = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const WORD = /[A-Za-z_$][\w$]*/y;
const LIT = {true: true, false: false, null: null};
const PAIR = {'{': '}', '[': ']', '"': '"'};

export function tokenize(src)
{
    const out = [];
    const at = (re, i) => {re.lastIndex = i; return re.exec(src);};
    for (let i = 0, m; i < src.length; i = out.at(-1).e)
    {
        if ((m = at(WS, i))) {i += m[0].length; if (i >= src.length) break;}
        const c = src[i];
        let tok;
        if ('{}[],:'.includes(c)) tok = {t: 'p', v: c, e: i + 1};
        else if (c === '"')
        {
            m = at(STR, i);
            tok = {t: 'str', e: i + m[0].length};
            if (!m[2]) tok = {t: 'bad', e: tok.e, msg: '字串沒有結尾的 "'};
            else try {tok.v = JSON.parse(m[0]);} catch {tok = {t: 'bad', e: tok.e, msg: '字串裡有不合法的字元或跳脫'};}
        }
        else if (c === '-' || (c >= '0' && c <= '9'))
        {
            m = at(NUM, i);
            tok = NUM_OK.test(m[0]) ? {t: 'num', v: Number(m[0]), e: i + m[0].length} : {t: 'bad', e: i + Math.max(1, m[0].length), msg: `不是合法的數字：${m[0]}`};
        }
        else if ((m = at(WORD, i))) tok = m[0] in LIT ? {t: 'lit', v: LIT[m[0]], e: i + m[0].length} : {t: 'id', v: m[0], e: i + m[0].length};
        else tok = {t: 'bad', e: i + 1, msg: `多了不認識的字元 ${c}`};
        tok.s = i;
        out.push(tok);
    }
    return out;
}

// 回傳 {value, err: {tok, msg, line} | null, toks}；空白當 {}，最外層要是物件
export function parse(src)
{
    const toks = tokenize(src);
    let i = 0;
    const isP = (tok, c) => tok?.t === 'p' && tok.v === c;
    const fail = (tok, msg) => {throw {tok, msg};};
    const peek = (open) => {
        const tok = toks[i];
        if (!tok) fail(open, `這個 ${open.v} 沒有關起來`);
        if (tok.t === 'bad') fail(tok, tok.msg);
        return tok;
    };
    const next = (open) => {const tok = peek(open); i++; return tok;};
    const value = (open) => {
        const tok = next(open);
        if (isP(tok, '{')) return obj(tok);
        if (isP(tok, '[')) return arr(tok);
        if (tok.t === 'str' || tok.t === 'num' || tok.t === 'lit') return tok.v;
        if (tok.t === 'id') fail(tok, `${tok.v} 不是合法的值（字串要加 "）`);
        fail(tok, '這裡應該是值');
    };
    const obj = (open) => {
        const o = {};
        for (;;)
        {
            if (isP(peek(open), '}')) {i++; return o;}
            const key = next(open);
            if (key.t !== 'str' && key.t !== 'id') fail(key, '這裡應該是 key');
            if (Object.hasOwn(o, key.v)) fail(key, `key 重複：${key.v}`);
            if (!isP(next(open), ':')) fail(toks[i - 1], 'key 後面少了 :');
            Object.defineProperty(o, key.v, {value: value(open), enumerable: true, writable: true, configurable: true});
            const tok = next(open);
            if (isP(tok, '}')) return o;
            if (!isP(tok, ',')) fail(tok, '前面少了 ,');
        }
    };
    const arr = (open) => {
        const a = [];
        for (;;)
        {
            if (isP(peek(open), ']')) {i++; return a;}
            a.push(value(open));
            const tok = next(open);
            if (isP(tok, ']')) return a;
            if (!isP(tok, ',')) fail(tok, '前面少了 ,');
        }
    };
    try
    {
        if (!toks.length) return {value: {}, err: null, toks};
        const v = value(null);
        if (toks[i]) fail(toks[i], '後面多出來的東西');
        if (!isP(toks[0], '{')) fail(toks[0], '要是 { } 物件');
        return {value: v, err: null, toks};
    }
    catch (e)
    {
        if (!e.tok) throw e;
        return {value: undefined, err: {...e, line: src.slice(0, e.tok.s).split('\n').length}, toks};
    }
}

const esc = (s) => s.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[c]);

function cls(tok, nxt)
{
    if (tok.t === 'p') return '{}'.includes(tok.v) ? 'brace' : '[]'.includes(tok.v) ? 'bracket' : 'punc';
    if ((tok.t === 'str' || tok.t === 'id') && nxt?.t === 'p' && nxt.v === ':') return 'key';
    return {str: 'str', num: 'num', lit: 'lit'}[tok.t] ?? '';
}

export function paint(src, toks, errTok)
{
    let html = '', at = 0;
    toks.forEach((tok, j) => {
        html += esc(src.slice(at, tok.s)) + `<span class="je-${tok === errTok ? 'err' : cls(tok, toks[j + 1])}">${esc(src.slice(tok.s, tok.e))}</span>`;
        at = tok.e;
    });
    return html + esc(src.slice(at)) + '\n';
}

// ---------- 打字輔助 ----------
// 游標所在那行，未關的字串從哪開始（-1 = 不在字串裡）；JSON 字串不跨行
function strStart(v, pos)
{
    let q = -1;
    for (let i = v.lastIndexOf('\n', pos - 1) + 1; i < pos; i++)
    {
        if (v[i] === '\\' && q >= 0) i++;
        else if (v[i] === '"') q = q >= 0 ? -1 : i;
    }
    return q;
}

// execCommand 才會進 textarea 自己的復原紀錄
function insert(ta, text, caret)
{
    const s = ta.selectionStart;
    document.execCommand('insertText', false, text);
    if (caret !== undefined) ta.setSelectionRange(s + caret, s + caret);
}

const moveTo = (ta, p) => ta.setSelectionRange(p, p);
const closeable = (c) => !c || /[\s,:}\]]/.test(c);

function indent(ta, out)
{
    const v = ta.value, s = ta.selectionStart, end = ta.selectionEnd;
    if (s === end && !out) return insert(ta, '  ');
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    let le = v.indexOf('\n', end > s && v[end - 1] === '\n' ? end - 1 : end);
    if (le < 0) le = v.length;
    let d0 = 0, total = 0;
    const text = v.slice(ls, le).split('\n').map((l, j) => {
        const d = out ? -Math.min(2, /^ */.exec(l)[0].length) : 2;
        if (j === 0) d0 = d;
        total += d;
        return d > 0 ? '  ' + l : l.slice(-d);
    }).join('\n');
    if (!total) return;
    ta.setSelectionRange(ls, le);
    insert(ta, text);
    ta.setSelectionRange(Math.max(ls, s + d0), s === end ? Math.max(ls, s + d0) : end + total);
}

function onKey(ta, e)
{
    if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
    const v = ta.value, s = ta.selectionStart, end = ta.selectionEnd, one = s === end;
    const prev = v[s - 1], next = v[end];
    const qs = strStart(v, s), inStr = qs >= 0;
    const done = () => {e.preventDefault(); return true;};
    let key = e.key;
    if (key === "'")
    {
        // 用 ' 開的字串再打 ' 就是要關掉；其他字串裡的 ' 是內容（it's）
        if (!inStr) key = '"';
        else if (one && next === '"' && ta._sq === qs) return done() && moveTo(ta, s + 1);
        else return;
    }
    switch (key)
    {
        case ':':
        {
            const m = one && !inStr && /(?:^|[{,])\s*([A-Za-z_$][\w$]*)(\s*)$/.exec(v.slice(0, s));
            if (!m) return;
            done();
            ta.setSelectionRange(s - m[1].length - m[2].length, s);
            return insert(ta, `"${m[1]}"${m[2]}:`);
        }
        case '"':
            if (inStr) return one && next === '"' && done() && moveTo(ta, s + 1);
            ta._sq = e.key === "'" ? s : undefined;
            if (!one) return done() && insert(ta, `"${v.slice(s, end)}"`);
            if (closeable(next)) return done() && insert(ta, '""', 1);
            if (e.key === "'") return done() && insert(ta, '"');
            return;
        case '{': case '[':
            if (inStr) return;
            if (!one) return done() && insert(ta, key + v.slice(s, end) + PAIR[key]);
            if (closeable(next)) return done() && insert(ta, key + PAIR[key], 1);
            return;
        case '}': case ']':
            if (!inStr && one && next === key) return done() && moveTo(ta, s + 1);
            return;
        case 'Backspace':
            if (!one || !prev || PAIR[prev] !== next) return;
            done();
            ta.setSelectionRange(s - 1, s + 1);
            return document.execCommand('delete');
        case 'Enter':
        {
            if (e.shiftKey) return;
            done();
            const line = v.slice(v.lastIndexOf('\n', s - 1) + 1, s);
            const ind = /^[ \t]*/.exec(line)[0];
            const open = /([{[])\s*$/.exec(line)?.[1];
            if (open && one && next === PAIR[open]) return insert(ta, `\n${ind}  \n${ind}`, ind.length + 3);
            return insert(ta, `\n${ind}${open ? '  ' : ''}`);
        }
        case 'Tab':
            done();
            return indent(ta, e.shiftKey);
    }
}

// ---------- 元件 ----------
// onApply(value)：失焦時沒錯就套用；onDraft(text, msg)：失焦時有錯，呼叫端自己留草稿
export function jsonEdit({text, k, draft, placeholder, onApply, onDraft})
{
    const box = document.createElement('div');
    const pre = document.createElement('pre');
    const ta = document.createElement('textarea');
    const tag = document.createElement('span');
    box.className = 'je';
    pre.className = 'je-hl';
    ta.className = 'je-ta';
    tag.className = 'je-tag';
    ta.dataset.k = k;
    ta.wrap = 'off';
    ta.spellcheck = false;
    ta.placeholder = placeholder ?? '';
    ta.value = text;
    box.append(pre, ta, tag);

    let last;
    const sync = () => {pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft;};
    const refresh = () => {
        last = parse(ta.value);
        pre.innerHTML = paint(ta.value, last.toks, last.err?.tok);
        box.title = last.err ? `第 ${last.err.line} 行：${last.err.msg}` : '';
        tag.textContent = last.err ? `未套用：${box.title}` : '未套用';
        ta.rows = Math.min(30, Math.max(2, ta.value.split('\n').length));
        sync();
    };
    ta.addEventListener('input', refresh);
    ta.addEventListener('scroll', sync);
    ta.addEventListener('keydown', e => onKey(ta, e));
    ta.addEventListener('change', () => {
        box.classList.toggle('draft', !!last.err);
        if (last.err) onDraft(ta.value, box.title);
        else onApply(last.value);
    });
    box.classList.toggle('draft', !!draft);
    refresh();
    return box;
}
