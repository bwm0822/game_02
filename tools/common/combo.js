// 自己的下拉選單，取代 <input list>：datalist 會拿框裡現有的值篩選，有值時看不到其他選項
// 用法：input 加 data-combo="<datalist id>"（逗號分隔的 tags 欄位再加 data-tags），選項讀那個 datalist 的 option（有 label 就當說明）
// 點框或按 ↓ 列全部、打字才篩選；選了就設值並送出 change，跟原本的 onchange 接在一起
// data-expr（條件／指令，input 或 textarea）：只補游標前的那個字，打字才開、Ctrl+空白鍵也開，選了不送 change（失焦時才套用）
const pop = document.createElement('div');
pop.className = 'combo';
pop.hidden = true;
document.body.append(pop);

let input = null, items = [], hi = -1;

const isTags = (el) => 'tags' in el.dataset;
const isExpr = (el) => 'expr' in el.dataset;
const TOKEN = /[\w.:*@-]*$/;
const token = (el) => el.value.slice(0, el.selectionStart).match(TOKEN)[0];
const current = (el) => isExpr(el) ? token(el) : (isTags(el) ? el.value.split(',').at(-1) : el.value).trim();

function options(el)
{
    return [...(document.getElementById(el.dataset.combo)?.options ?? [])].map(o => ({v: o.value, lab: o.label === o.value ? '' : o.label}));
}

function open(el, filter)
{
    input = el;
    const cur = current(el), q = filter ? cur.toLowerCase() : '';
    items = options(el).filter(o => !q || o.v.toLowerCase().includes(q) || o.lab.toLowerCase().includes(q));
    if (!items.length) return close();
    hi = items.findIndex(o => o.v === cur);
    if (hi < 0 && isExpr(el)) hi = 0;
    pop.replaceChildren(...items.map((o, i) => {
        const d = document.createElement('div');
        d.className = 'opt' + (o.v === cur ? ' cur' : '');
        d.append(o.v);
        if (o.lab) {const s = document.createElement('span'); s.className = 'lab'; s.textContent = o.lab; d.append(s);}
        d.addEventListener('mousedown', e => e.preventDefault());
        d.addEventListener('click', () => pick(i));
        return d;
    }));
    const r = el.getBoundingClientRect();
    Object.assign(pop.style, {left: `${r.left}px`, top: `${r.bottom}px`, minWidth: `${r.width}px`});
    pop.hidden = false;
    move(0);
}

function close()
{
    pop.hidden = true;
    input = null;
}

function move(d)
{
    if (d) hi = Math.max(0, Math.min(items.length - 1, hi + d));
    [...pop.children].forEach((c, i) => c.classList.toggle('hi', i === hi));
    pop.children[hi]?.scrollIntoView({block: 'nearest'});
}

function pick(i)
{
    const el = input, v = items[i].v;
    close();
    if (isExpr(el))
    {
        const end = el.selectionStart, start = end - token(el).length;
        el.setRangeText(v, start, end, 'end');
        return;
    }
    if (isTags(el))
    {
        const at = el.value.lastIndexOf(',');
        el.value = at < 0 ? v : `${el.value.slice(0, at + 1)} ${v}`;
    }
    else el.value = v;
    el.dispatchEvent(new Event('change', {bubbles: true}));
}

const combo = (e) => e.target.matches?.('input[data-combo], textarea[data-combo]') ? e.target : null;

document.addEventListener('mousedown', e => {
    const el = combo(e);
    if (!el) return;
    if (isExpr(el)) close();
    else input === el ? close() : open(el, false);
});
document.addEventListener('input', e => {
    const el = combo(e);
    if (!el) return;
    if (isExpr(el) && !token(el)) close();
    else open(el, true);
});
document.addEventListener('focusout', e => {if (e.target === input) close();});
document.addEventListener('scroll', e => {if (input && e.target !== pop) close();}, true);
// capture：比欄位自己的 keydown（總覽表的 Enter 失焦、Esc 取消）先處理
document.addEventListener('keydown', e => {
    const el = combo(e);
    if (!el) return;
    const shown = input === el;
    const eat = () => {e.preventDefault(); e.stopPropagation();};
    if (e.key === ' ' && e.ctrlKey) {eat(); open(el, isExpr(el)); return;}
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (shown || !isExpr(el)))
    {
        eat();
        if (!shown) open(el, false);
        else move(e.key === 'ArrowDown' ? 1 : -1);
    }
    else if (e.key === 'Enter' && shown && hi >= 0) {eat(); pick(hi);}
    else if (e.key === 'Escape' && shown) {eat(); close();}
    else if (e.key === 'Tab' && shown && hi >= 0 && isExpr(el)) {eat(); pick(hi);}
    else if (e.key === 'Enter' || e.key === 'Tab') close();
}, true);
