// HH:MM 時間選擇：不能打字，點「時」或「分」彈出 5 格選單（中間＝目前值、上下各兩格、循環），
// 滾輪一格 ±1 滾就寫、點格子寫入並關閉、點外面／Esc 關（不還原）；空的／壞的從 08:00 起算，選了就整個寫成合法 HH:MM
// 連續滾併成一步 undo：選單格子的 data-k 跟 H.arrow(k) 同一個，hist.js 的 mousedown 不會斷開；
// 打開時拿掉焦點，免得每次寫完重畫還原焦點觸發 focusin 斷開
import {h} from './dom.js';
import * as H from './hist.js';

const parse = (v) => {const m = /^(\d\d):(\d\d)$/.exec(v ?? ''); return m && +m[1] < 24 && +m[2] < 60 ? [+m[1], +m[2]] : null;};
const pad = (n) => String(n).padStart(2, '0');
const DEF = [8, 0];

let pop = null;         // {el, k, seg, hm, pick}
let shut = null;        // 剛被 mousedown 關掉的那段（再點同一段＝收起，不重開）

function close()
{
    pop?.el.remove();
    pop = null;
}

function place()
{
    const a = document.querySelector(`[data-k="${CSS.escape(`${pop.k}.${pop.seg}`)}"]`);
    if (!a) return close();
    const r = a.getBoundingClientRect(), cell = pop.el.firstChild?.getBoundingClientRect().height ?? r.height;
    pop.el.style.left = `${r.left + r.width / 2 - pop.el.offsetWidth / 2}px`;
    pop.el.style.top = `${r.top + r.height / 2 - cell * 2.5}px`;
}

function draw()
{
    const i = pop.seg === 'h' ? 0 : 1, n = i ? 60 : 24, cur = pop.hm[i];
    pop.el.replaceChildren(...[-2, -1, 0, 1, 2].map(d => {
        const v = (cur + d + n) % n;
        return h('div', {class: 'tp-cell' + (d ? '' : ' cur'), dataset: {k: pop.k}, onclick: () => {set(v); close();}}, pad(v));
    }));
}

function set(v)
{
    pop.hm[pop.seg === 'h' ? 0 : 1] = v;
    H.arrow(pop.k);
    pop.pick(`${pad(pop.hm[0])}:${pad(pop.hm[1])}`);
    H.clear();
    if (!pop) return;
    draw();
    place();
}

function open(k, seg, value, pick, anchor)
{
    close();
    document.activeElement?.blur();
    const el = h('div', {class: 'tpick-pop'});
    el.addEventListener('wheel', (e) => {
        e.preventDefault();
        const i = pop.seg === 'h' ? 0 : 1, n = i ? 60 : 24;
        set((pop.hm[i] + Math.sign(e.deltaY) + n) % n);
    }, {passive: false});
    (anchor.closest('dialog') ?? document.body).append(el);
    pop = {el, k, seg, hm: [...(parse(value) ?? DEF)], pick};
    draw();
    place();
}

document.addEventListener('mousedown', (e) => {
    shut = null;
    if (!pop || pop.el.contains(e.target)) return;
    shut = `${pop.k}.${pop.seg}`;
    close();
}, true);
document.addEventListener('keydown', (e) => {
    if (!pop || e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close();
}, true);
document.addEventListener('scroll', () => pop && place(), true);

// k：data-k 前綴（時／分兩段是 `${k}.h`／`${k}.m`）；pick(HH:MM)：選了就呼叫（作息卡片＝立刻寫、對話框＝只改框裡的值）
// opt.unit＝顯示成「HH 時 MM 分」（長度用，值一樣是 HH:MM）
export function timePick(k, value, pick, opt = {})
{
    let cur = value ?? '';
    const ok = parse(cur), bad = cur !== '' && !ok;
    const [hs, ms] = ok ? cur.split(':') : bad ? (cur.includes(':') ? cur.split(':', 2) : [cur, '--']) : ['--', '--'];
    const segH = h('span', {class: 'tp-seg', dataset: {k: `${k}.h`}}, hs);
    const segM = h('span', {class: 'tp-seg', dataset: {k: `${k}.m`}}, ms);
    const wrap = h('span', {class: 'tpick' + (bad ? ' bad' : ''), dataset: {k}, title: bad ? `時間要是 HH:MM：${cur}` : null},
        ...(opt.unit ? [segH, ' 時 ', segM, ' 分'] : [segH, ':', segM]));
    const put = (v) => {
        cur = v;
        [segH.textContent, segM.textContent] = v.split(':');
        wrap.classList.remove('bad');
        wrap.removeAttribute('title');
        pick(v);
    };
    for (const [seg, el] of [['h', segH], ['m', segM]])
        el.onclick = (e) => {
            e.preventDefault();     // 包在 <label> 裡時不要把焦點丟給同 label 的「出發／抵達」下拉
            if (shut === `${k}.${seg}`) {shut = null; return;}
            open(k, seg, cur, put, el);
            requestAnimationFrame(() => pop && place());
        };
    return wrap;
}
