// JSON 文字框：透明 textarea 疊在上色的 <pre> 上，打字即時檢查（只把第一個出錯的 token 標紅），右上角 [修正]／[錯誤]
// 寬鬆：裸 key、結尾多餘逗號不算錯，套用時用解析出來的值所以自然變標準 JSON
const WS = /\s+/y;
const STR = /"((?:[^"\\\n]|\\.)*)("?)/y;
const NUM = /-?(?:[eE][+-]|[\w.])*/y;
const NUM_OK = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const WORD = /[A-Za-z_$][\w$]*/y;
const LIT = {true: true, false: false, null: null};
const PAIR = {'{': '}', '[': ']', '"': '"'};

// 修正 = 把 [s, e) 換成 text
const ins = (at, text) => ({s: at, e: at, text, label: `補上 ${text}`});
const rep = (tok, text, label) => ({s: tok.s, e: tok.e, text, label: label ?? `改成 ${text}`});

function badNumFix(tok, t)
{
    const n = Number(t);
    return /^-?[\d.]+(?:[eE][+-]?\d+)?$/.test(t) && Number.isFinite(n) ? rep(tok, String(n)) : rep(tok, `"${t}"`);
}

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
            if (!m[2]) tok = {t: 'bad', e: tok.e, msg: '字串沒有結尾的 "', fix: ins(tok.e, '"')};
            else try {tok.v = JSON.parse(m[0]);} catch {tok = {t: 'bad', e: tok.e, msg: '字串裡有不合法的字元或跳脫'};}
        }
        else if (c === '-' || (c >= '0' && c <= '9') || (c === '.' && /\d/.test(src[i + 1])))
        {
            m = at(NUM, i);
            tok = NUM_OK.test(m[0]) ? {t: 'num', v: Number(m[0]), e: i + m[0].length} : {t: 'bad', e: i + Math.max(1, m[0].length), msg: `不是合法的數字：${m[0]}`, num: m[0]};
        }
        else if ((m = at(WORD, i))) tok = m[0] in LIT ? {t: 'lit', v: LIT[m[0]], e: i + m[0].length} : {t: 'id', v: m[0], e: i + m[0].length};
        else tok = {t: 'bad', e: i + 1, msg: `多了不認識的字元 ${c}`, fix: {s: i, e: i + 1, text: '', label: `刪掉 ${c}`}};
        tok.s = i;
        if (tok.num !== undefined) tok.fix = badNumFix(tok, tok.num);
        out.push(tok);
    }
    return out;
}

// 回傳 {value, err: {tok, msg, line, fix?: {s, e, text, label}} | null, toks}；空白當 {}，最外層要是物件
export function parse(src)
{
    const toks = tokenize(src);
    let i = 0;
    const isP = (tok, c) => tok?.t === 'p' && tok.v === c;
    const fail = (tok, msg, fix) => {throw {tok, msg, fix};};
    const peek = (open) => {
        const tok = toks[i];
        if (!tok) fail(open, `這個 ${open.v} 沒有關起來`, ins(toks.at(-1).e, PAIR[open.v]));
        if (tok.t === 'bad') fail(tok, tok.msg, tok.fix);
        return tok;
    };
    const next = (open) => {const tok = peek(open); i++; return tok;};
    // 值後面接的不是 , 也不是自己的右括號：別種右括號就是少關，其他當作少逗號
    const sep = (open, tok) => {
        const close = PAIR[open.v];
        if (isP(tok, close)) return true;
        if (isP(tok, ',')) return false;
        if (isP(tok, '}') || isP(tok, ']')) fail(tok, `這裡應該是 ${close}`, ins(tok.s, close));
        fail(tok, '前面少了 ,', ins(toks[i - 2].e, ','));
    };
    const value = (open) => {
        const tok = next(open);
        if (isP(tok, '{')) return obj(tok);
        if (isP(tok, '[')) return arr(tok);
        if (tok.t === 'str' || tok.t === 'num' || tok.t === 'lit') return tok.v;
        if (tok.t === 'id') fail(tok, `${tok.v} 不是合法的值（字串要加 "）`, rep(tok, `"${tok.v}"`));
        fail(tok, '這裡應該是值');
    };
    const obj = (open) => {
        const o = {};
        for (;;)
        {
            if (isP(peek(open), '}')) {i++; return o;}
            const key = next(open);
            if (key.t === 'num' || key.t === 'lit') fail(key, 'key 要是字串', rep(key, `"${src.slice(key.s, key.e)}"`));
            if (key.t !== 'str' && key.t !== 'id') fail(key, '這裡應該是 key');
            if (Object.hasOwn(o, key.v)) fail(key, `key 重複：${key.v}`);
            if (!isP(next(open), ':')) fail(toks[i - 1], 'key 後面少了 :', ins(key.e, ':'));
            Object.defineProperty(o, key.v, {value: value(open), enumerable: true, writable: true, configurable: true});
            if (sep(open, next(open))) return o;
        }
    };
    const arr = (open) => {
        const a = [];
        for (;;)
        {
            if (isP(peek(open), ']')) {i++; return a;}
            a.push(value(open));
            if (sep(open, next(open))) return a;
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
export function jsonEdit({text, k, placeholder, onApply, onDraft})
{
    const box = document.createElement('div');
    const area = document.createElement('div');
    const pre = document.createElement('pre');
    const ta = document.createElement('textarea');
    const btn = document.createElement('button');
    box.className = 'je';
    area.className = 'je-area';
    pre.className = 'je-hl';
    ta.className = 'je-ta';
    btn.type = 'button';
    ta.dataset.k = k;
    ta.wrap = 'off';
    ta.spellcheck = false;
    ta.placeholder = placeholder ?? '';
    ta.value = text;
    area.append(pre, ta);
    box.append(area, btn);

    let last;
    const reason = () => `第 ${last.err.line} 行：${last.err.msg}`;
    const sync = () => {pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft;};
    const refresh = () => {
        last = parse(ta.value);
        pre.innerHTML = paint(ta.value, last.toks, last.err?.tok);
        const fix = last.err?.fix;
        btn.className = fix ? 'je-fix' : 'je-bad';
        btn.classList.toggle('off', !last.err);
        btn.textContent = fix ? '修正' : '錯誤';
        btn.title = !last.err ? '' : fix ? `${fix.label}（${reason()}）` : reason();
        ta.rows = Math.min(30, Math.max(2, ta.value.split('\n').length));
        sync();
    };
    ta.addEventListener('input', refresh);
    ta.addEventListener('scroll', sync);
    ta.addEventListener('keydown', e => onKey(ta, e));
    ta.addEventListener('change', () => last.err ? onDraft(ta.value, reason()) : onApply(last.value));
    // 不讓按鈕搶走焦點，修正才進得了 textarea 的復原紀錄、也不會先觸發 change
    btn.addEventListener('mousedown', e => e.preventDefault());
    btn.addEventListener('click', () => {
        const fix = last.err?.fix;
        if (!fix) return;
        ta.focus();
        ta.setSelectionRange(fix.s, fix.e);
        insert(ta, fix.text);
    });
    refresh();
    return box;
}
