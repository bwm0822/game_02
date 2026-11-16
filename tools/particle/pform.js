// 粒子條目（particle.json 的一筆）的表單、檢查、圖示：粒子分頁跟場景分頁（發射點自己那份 def）共用
// createPForm({S, F, set, commit, render})：S＝{data:{id: 條目}, open, json, drafts}，F＝form.js 的 createForm(同一個 S)，set(id, path, v) 改一個欄位
import {h, status} from '../common/dom.js';
import {str, isObj, replaceRaw, parseNum} from '../common/obj.js';
import {fieldInput, numInput} from '../common/form.js';
import * as IC from '../common/icons.js';
import {BUILTIN, builtinCanvas} from '../../src/core/particle.js';
import {EASE} from '../../src/core/pose.js';
import * as SC from './schema.js';

export const isBurst = (p) => p?.mode === 'burst';
const isEmoji = (img) => !!img && !BUILTIN.includes(img) && IC.resolve(img).kind === 'text';

// 內建形狀用 canvas 畫（icons.js 不認得 p-）
export function pIcon(img, size)
{
    if (!BUILTIN.includes(img)) return IC.iconEl(img, size);
    const src = builtinCanvas(img), cv = document.createElement('canvas');
    cv.width = cv.height = size;
    cv.className = 'ico builtin';
    cv.title = img;
    const g = cv.getContext('2d'), k = Math.min(size / src.width, size / src.height) * 0.8;
    g.drawImage(src, (size - src.width * k) / 2, (size - src.height * k) / 2, src.width * k, src.height * k);
    return cv;
}

// 只看內容的檢查（只警告）
export function validateDef(p)
{
    const out = [];
    if (!p) return out;
    if (p.img !== undefined && !BUILTIN.includes(p.img) && !isEmoji(p.img)) {const e = IC.check(p.img); if (e) out.push(`img：${e}`);}
    if (p.mode !== undefined && p.mode !== 'burst' && p.mode !== 'stream') out.push(`mode 不認識的值：${p.mode}（burst／stream）`);
    for (const k of ['count', 'duration', 'x', 'y', 'frequency', 'maxParticles', 'gravityX', 'gravityY'])
        if (p[k] !== undefined && typeof p[k] !== 'number') out.push(`${k} 不是數字：${str(p[k])}`);
    if (p.local !== undefined && typeof p.local !== 'boolean') out.push('local 應該是 true/false');
    if (p.depth !== undefined && p.depth !== 'under') out.push(`depth 不認識的值：${p.depth}（只有 under）`);
    if (isBurst(p) && p.duration !== undefined) out.push('一次噴的不看 duration');
    if (isBurst(p) && p.frequency !== undefined) out.push('一次噴的不看 frequency');
    if (!isBurst(p) && p.count !== undefined) out.push('持續噴的不看 count（每次噴幾顆是 quantity）');
    if (!isBurst(p) && p.frequency === -1) out.push('frequency -1＝不會自己噴，持續模式會什麼都看不到');
    if (isEmoji(p.img) && (p.tint !== undefined || p.color !== undefined)) out.push('emoji 不吃 tint／color（彩色字形染了會髒）');
    if (p.blendMode !== undefined && !(typeof p.blendMode === 'string' && SC.BLENDS.includes(p.blendMode.toUpperCase())) && typeof p.blendMode !== 'number')
        out.push(`blendMode 不認識的值：${p.blendMode}`);
    for (const k of ['tint'])
    {
        const bad = (c) => !(typeof c === 'number' || (typeof c === 'string' && /^#?[0-9a-f]{6}$/i.test(c)));
        const v = p[k];
        if (v === undefined) continue;
        const vals = isObj(v) ? [v.start, v.end].filter(x => x !== undefined) : Array.isArray(v) ? v : [v];
        if (vals.some(bad)) out.push(`${k} 顏色要寫 "#rrggbb"：${str(v)}`);
    }
    for (const [k, def] of Object.entries(SC.PROPS))
        if (def.kind === 'val' && isObj(p[k]) && p[k].ease !== undefined && !(p[k].ease in EASE)) out.push(`${k}.ease 不認識的曲線：${p[k].ease}`);
    for (const k of ['emitZone', 'deathZone'])
    {
        const z = p[k], Z = SC.ZONES[k];
        if (z === undefined) continue;
        if (!(isObj(z) || Array.isArray(z))) {out.push(`${k} 應該是物件`); continue;}
        for (const one of [z].flat())
        {
            if (!isObj(one)) continue;
            if (one.type !== undefined && !Z.types.includes(one.type)) out.push(`${k}.type 不認識的值：${one.type}（${Z.types.join('／')}）`);
            const sh = SC.shapeOf(one.source);
            if (!sh) out.push(`${k}.source 認不得的形狀（{x,y,w,h}｜{x,y,r}｜{x1,y1,x2,y2}）`);
            else if (!Z.shapes.includes(sh)) out.push(`${k} 不能用${SC.SHAPES[sh]}（Phaser 判斷不了粒子在不在裡面）`);
            if (k === 'emitZone' && one.type === 'edge' && one.quantity === undefined && one.stepRate === undefined) out.push('emitZone 沿邊緣噴要寫 quantity');
        }
    }
    return out;
}

// 曲線名的 datalist（ease 欄位的 combo 用）
export const easeNames = () => Object.keys(EASE);

export function createPForm({S, F, set, commit, render})
{
    // ---------- 自己的欄位 ----------
    function imgInput(id, v)
    {
        const put = (x) => set(id, ['img'], x);
        return h('span', {class: 'iconField'},
            pIcon(v ?? 'p-dot', 32),
            h('select', {dataset: {k: 'img#builtin'}, title: '內建形狀', onchange: e => e.target.value && put(e.target.value)},
                h('option', {value: ''}, '內建…'), BUILTIN.map(b => h('option', {value: b, selected: b === v}, b))),
            h('input', {dataset: {k: 'img'}, size: 16, value: v ?? '', placeholder: 'p-dot', onchange: e => put(e.target.value.trim() || undefined)}),
            h('button', {type: 'button', onclick: async () => {const x = await IC.pickIcon(v); if (x !== null) put(x || undefined);}}, '選圖…'));
    }

    function ownFields(id, p)
    {
        const mode = isBurst(p) ? 'burst' : 'stream';
        return Object.entries(SC.OWN).filter(([k, d]) => !d.mode || d.mode === mode || p[k] !== undefined).map(([k, d]) => [
            h('span', {class: 'k' + (p[k] === undefined ? ' unset' : ''), title: k}, d.label),
            h('span', {class: 'iconField'},
                d.type === 'pimg' ? imgInput(id, p.img) : fieldInput(d, p[k], v => set(id, [k], v), k),
                d.hint && h('span', {class: 'dim'}, d.hint)),
        ]);
    }

    // ---------- Phaser 欄位 ----------
    const num = (val, k, f, ph) => numInput(k, null, 'num', val, ph, f, SC.PROPS[k.split('.')[0]]?.step ?? 'any');
    const toHex = (c) => typeof c === 'number' ? `#${c.toString(16).padStart(6, '0')}` : /^#?[0-9a-f]{6}$/i.test(c ?? '') ? `#${c.replace('#', '')}` : '#ffffff';
    const colorIn = (val, k, f) => h('input', {type: 'color', dataset: {k}, value: toHex(val), onchange: e => f(e.target.value)});

    function jsonIn(v, k, put)
    {
        return h('input', {size: 34, dataset: {k}, value: str(v), onchange: e => {
            try {put(JSON.parse(e.target.value));} catch {status(`${k} 不是合法的 JSON`); render();}
        }});
    }

    function valEditor(id, k, v)
    {
        const put = (x) => set(id, [k], x), mode = SC.valMode(v);
        const modes = [['num', '數值'], ['range', '範圍'], ['se', '漸變'], ['pick', '隨機挑'], ...mode === 'raw' ? [['raw', 'JSON']] : []];
        const sel = h('select', {dataset: {k: `${k}#mode`}, onchange: e => put(SC.convertVal(v, e.target.value))},
            modes.map(([m, n]) => h('option', {value: m, selected: m === mode}, n)));
        if (mode === 'num') return [sel, num(v, k, n => put(n ?? 0))];
        if (mode === 'range') return [sel, num(v.min, `${k}.min`, n => put({...v, min: n ?? 0})), h('span', {class: 'dim'}, '～'), num(v.max, `${k}.max`, n => put({...v, max: n ?? 0}))];
        if (mode === 'se') return [sel, num(v.start, `${k}.start`, n => put({...v, start: n ?? 0})), h('span', {class: 'dim'}, '→'), num(v.end, `${k}.end`, n => put({...v, end: n ?? 0})),
            h('input', {size: 10, dataset: {k: `${k}.ease`, combo: 'dl-eases'}, title: SC.EASE_HINT, placeholder: '曲線', value: v.ease ?? '',
                onchange: e => {const o = {...v, ease: e.target.value.trim() || undefined}; if (!o.ease) delete o.ease; put(o);}})];
        if (mode === 'pick') return [sel, h('input', {size: 16, dataset: {k}, value: v.join(', '), title: '每顆隨機挑一個',
            onchange: e => {const a = e.target.value.split(',').map(s => parseNum(s)).filter(n => n !== undefined); put(a.length ? a : undefined);}})];
        return [sel, jsonIn(v, k, put)];
    }

    function colorEditor(id, k, v)
    {
        const put = (x) => set(id, [k], x);
        const mode = isObj(v) && 'start' in v ? 'se' : (typeof v === 'string' || typeof v === 'number') ? 'one' : 'raw';
        const sel = h('select', {dataset: {k: `${k}#mode`}, onchange: e => put(e.target.value === 'se' ? {start: mode === 'one' ? toHex(v) : '#ffffff', end: '#ff0000'} : mode === 'se' ? toHex(v.start) : '#ffffff')},
            [['one', '單色'], ['se', '漸變'], ...mode === 'raw' ? [['raw', 'JSON']] : []].map(([m, n]) => h('option', {value: m, selected: m === mode}, n)));
        if (mode === 'one') return [sel, colorIn(v, k, put), h('span', {class: 'dim'}, toHex(v))];
        if (mode === 'se') return [sel, colorIn(v.start, `${k}.start`, c => put({...v, start: c})), h('span', {class: 'dim'}, '→'), colorIn(v.end, `${k}.end`, c => put({...v, end: c}))];
        return [sel, jsonIn(v, k, put)];
    }

    function colorsEditor(id, k, v)
    {
        const put = (x) => set(id, [k], x);
        if (!Array.isArray(v)) return [jsonIn(v, k, put)];
        return [
            ...v.map((c, i) => h('span', {class: 'chip'}, colorIn(c, `${k}.${i}`, x => put(v.map((y, j) => j === i ? x : y))),
                v.length > 2 && h('button', {type: 'button', title: '拿掉這個顏色', onclick: () => put(v.filter((_, j) => j !== i))}, '−'))),
            h('button', {type: 'button', title: '加一個顏色', dataset: {k: `${k}#add`}, onclick: () => put([...v, v.at(-1) ?? '#ffffff'])}, '＋'),
        ];
    }

    // emitZone／deathZone：type、形狀、數字（預覽也能拖）；陣列或認不得的寫法退回 JSON 框
    function zoneEditor(id, k, z)
    {
        const put = (x) => set(id, [k], x);
        if (!SC.zoneEditable(k, z)) return [jsonIn(z, k, put)];
        const Z = SC.ZONES[k], s = z.source, shape = SC.shapeOf(s);
        const sel = (dk, list, cur, names, f) => h('select', {dataset: {k: dk}, onchange: e => f(e.target.value)},
            (list.includes(cur) ? list : [...list, cur]).map(o => h('option', {value: o, selected: o === cur}, names?.[o] ?? o)));
        const ph = shape === 'rect' ? {x: String(-s.w / 2), y: String(-s.h / 2)} : {x: '0', y: '0'};
        const nIn = (c) => [h('span', {class: 'dim'}, c), numInput(`${k}.source.${c}`, null, 'num', s[c], SC.optKey(shape, c) ? ph[c] : '', n => {
            const src = {...s};
            if (n === undefined && SC.optKey(shape, c)) delete src[c];
            else src[c] = n ?? 0;
            put({...z, source: src});
        }, 1)];
        const chk = (c, on, f) => h('label', null, h('input', {type: 'checkbox', dataset: {k: `${k}.${c}`}, checked: on, onchange: e => f(e.target.checked)}), c);
        return [
            sel(`${k}.type`, Z.types, z.type ?? Z.types[0], null, t => put(SC.setZoneType(z, t))),
            sel(`${k}#shape`, Z.shapes, shape, SC.SHAPES, sh => put({...z, source: SC.convertShape(s, sh)})),
            ...SC.SHAPE_KEYS[shape].flatMap(nIn),
            ...z.type === 'edge' ? [
                h('span', {class: 'dim'}, 'quantity'), numInput(`${k}.quantity`, null, 'int', z.quantity, '', n => {const o = {...z, quantity: n}; if (n === undefined) delete o.quantity; put(o);}, 1),
                chk('yoyo', !!z.yoyo, on => {const o = {...z, yoyo: true}; if (!on) delete o.yoyo; put(o);}),
                chk('seamless', z.seamless ?? true, on => {const o = {...z, seamless: false}; if (on) delete o.seamless; put(o);}),
            ] : [],
        ];
    }

    function propEditor(id, k, v)
    {
        const def = SC.PROPS[k], put = (x) => set(id, [k], x);
        switch (def.kind)
        {
            case 'zone': return zoneEditor(id, k, v);
            case 'val': return valEditor(id, k, v);
            case 'num': return [num(v, k, n => put(n))];
            case 'bool': return [h('input', {type: 'checkbox', dataset: {k}, checked: !!v, onchange: e => put(e.target.checked)})];
            case 'color': return colorEditor(id, k, v);
            case 'colors': return colorsEditor(id, k, v);
            case 'blend': return [h('select', {dataset: {k}, onchange: e => put(e.target.value)},
                (SC.BLENDS.includes(String(v).toUpperCase()) ? SC.BLENDS : [...SC.BLENDS, v]).map(b => h('option', {value: b, selected: String(v).toUpperCase() === b}, b)))];
            default: return [jsonIn(v, k, put)];
        }
    }

    function groupBox(id, p, {k: g, label})
    {
        const keys = Object.keys(SC.PROPS).filter(k => SC.PROPS[k].group === g);
        const used = keys.filter(k => p[k] !== undefined), rest = keys.filter(k => p[k] === undefined);
        const open = S.open[g] ??= true;
        const sum = used.map(k => `${k}:${str(p[k])}`).join('  ');
        return h('div', {class: 'box'},
            F.boxBar(g, open, true, h('span', null, label), h('span', {class: 'grow'}), !open && h('span', {class: 'dim'}, sum)),
            open && h('div', {class: 'props'},
                used.map(k => h('div', {class: 'prop'},
                    h('span', {class: 'k', title: k}, k),
                    ...propEditor(id, k, p[k]),
                    SC.PROPS[k].hint && h('span', {class: 'dim'}, SC.PROPS[k].hint),
                    h('button', {type: 'button', title: '移除', onclick: () => set(id, [k], undefined)}, '×'))),
                rest.length > 0 && h('select', {dataset: {k: `${g}.#add`}, onchange: e => set(id, [e.target.value], structuredClone(SC.PROPS[e.target.value].def))},
                    h('option', {value: ''}, '＋ 加屬性'), rest.map(k => h('option', {value: k, title: SC.PROPS[k].hint ?? ''}, k)))));
    }

    function otherBox(id, p)
    {
        const raw = Object.fromEntries(Object.entries(p).filter(([k]) => !SC.isKnown(k)));
        const n = Object.keys(raw).length;
        const open = S.open['#raw'] ??= n > 0;
        return h('div', {class: 'box'},
            F.boxBar('#raw', open, true, '其他 Phaser 欄位', h('span', {class: 'dim'}, n ? `（${n}）` : '（表單沒列的 key 寫這裡，原樣傳給 Phaser）')),
            open && F.rawArea(p, SC.isKnown, raw => commit(() => replaceRaw(S.data[id], SC.isKnown, raw)), '#raw'));
    }

    // 警告＋整筆 JSON 或表單本體
    function body(id, p)
    {
        const warns = validateDef(p), draft = F.fullDraft();
        return [
            (warns.length > 0 || draft) && h('ul', {class: 'warns'}, draft && h('li', null, draft), warns.map(w => h('li', null, w))),
            S.json ? F.fullJson(id) : [
                h('div', {class: 'fields'}, ownFields(id, p)),
                SC.GROUPS.map(g => groupBox(id, p, g)),
                otherBox(id, p),
            ],
        ];
    }

    return {body};
}
