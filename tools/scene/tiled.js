// prefab → Tiled（docs/prefab.md 第 5 步）：每筆 prefab 產生
//   縮圖 textures/prefabs/prefab-<id>.png（永遠出現的 png 零件合成，大小＝thumb＝所有狀態 png 的外框）
//   tilesets/prefabs.tsj 一格（圖片集合型；tile id 一旦給了就不換，地圖裡的 gid 才不會跑掉）
//   templates/prefabs/<id>.tj（gid＝那格、寬高＝thumb、屬性 prefab，type 預設 item；已有的保留 type 跟其他屬性）
// 遊戲裡 ItemView 有 prefab 就不畫 gid 那張縮圖，錨點用 thumb 從 tile 物件左下角換回來
import * as FS from '../common/fs.js';
import * as IC from '../common/icons.js';
import {stringify, eolOf} from '../common/tiledjson.js';
import {roleRefs, renameRoleRefs} from '../common/maproles.js';
import {joinPath} from '../../src/data/navgrid.js';
import {thumbImgs} from '../../src/core/prefab.js';

const ASSETS = 'public/assets';
const PNG_DIR = `${ASSETS}/textures/prefabs`;
const TSJ_DIR = `${ASSETS}/tilesets`;
const TSJ = 'prefabs.tsj';
const TPL_DIR = `${ASSETS}/templates/prefabs`;
export const thumbKey = (id) => `prefab-${id}`;
const DEF_THUMB = {x: -16, y: -32, w: 32, h: 32};
const FILE = 'file:';

async function mkdirs(root, path)
{
    let d = root;
    for (const seg of path.split('/')) d = await d.getDirectoryHandle(seg, {create: true});
    return d;
}

const loadImg = (url) => new Promise(res => {const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url;});

// 零件的圖：file: 圖（原圖、照 pct 縮）或 texture key（sheet／atlas 取那格）
async function partImg(img)
{
    if (img.startsWith(FILE))
    {
        const i = await loadImg(`/${img.slice(FILE.length).replace(/^public\//, '')}`);
        return i && {img: i, f: {x: 0, y: 0, w: i.naturalWidth, h: i.naturalHeight}};
    }
    return IC.frameOf(img);
}

// 永遠出現（沒寫 look）的 png 零件照 depth 合成進 thumb 框；一張都畫不出來＝半透明底＋外框
export async function renderThumb(pf, thumb = pf.thumb ?? DEF_THUMB)
{
    const cv = Object.assign(document.createElement('canvas'), {width: Math.max(1, thumb.w), height: Math.max(1, thumb.h)});
    const g = cv.getContext('2d');
    let n = 0;
    for (const p of thumbImgs(pf))
    {
        const r = await partImg(p.img);
        if (!r) continue;
        n++;
        const k = p.img.startsWith(FILE) ? (p.pct ?? 100) / 100 : 1;
        g.save();
        g.translate((p.x ?? 0) - thumb.x, (p.y ?? 0) - thumb.y);
        g.rotate((p.angle ?? 0) * Math.PI / 180);
        g.scale((p.flip ? -1 : 1) * (p.sx ?? 1) * k, (p.sy ?? 1) * k);
        g.drawImage(r.img, r.f.x, r.f.y, r.f.w, r.f.h, -(p.ox ?? 0.5) * r.f.w, -(p.oy ?? 1) * r.f.h, r.f.w, r.f.h);
        g.restore();
    }
    if (!n)
    {
        g.fillStyle = 'rgba(128,128,128,0.3)';
        g.fillRect(0, 0, cv.width, cv.height);
        g.strokeStyle = 'rgba(220,220,220,0.9)';
        g.lineWidth = 1;
        g.strokeRect(0.5, 0.5, cv.width - 1, cv.height - 1);
    }
    return cv;
}

async function readJson(dir, name)
{
    const fh = dir && await FS.tryFile(dir, name);
    if (!fh) return null;
    const text = await (await fh.getFile()).text();
    return {data: JSON.parse(text), eol: eolOf(text)};
}

async function writeJson(dir, name, data, eol = '\n')
{
    await FS.writeFile(dir, name, new Blob([stringify(data, eol)]));
}

async function tryPath(root, path)
{
    try {return await FS.resolveDir(root, path);} catch {return null;}
}

async function readTsj(root)
{
    const dir = await mkdirs(root, TSJ_DIR);
    const r = await readJson(dir, TSJ);
    const data = r?.data ?? {columns: 0, grid: {height: 1, orientation: 'orthogonal', width: 1}, margin: 0, name: 'prefabs', spacing: 0,
                              tilecount: 0, tiledversion: '1.11.0', tileheight: 1, tiles: [], tilewidth: 1, type: 'tileset', version: '1.10'};
    data.tiles ??= [];
    return {dir, data, eol: r?.eol};
}

async function writeTsj(t)
{
    t.data.tilecount = t.data.tiles.length;
    t.data.tilewidth = Math.max(1, ...t.data.tiles.map(x => x.imagewidth));
    t.data.tileheight = Math.max(1, ...t.data.tiles.map(x => x.imageheight));
    await writeJson(t.dir, TSJ, t.data, t.eol);
}

const imgPath = (id) => `../textures/prefabs/${thumbKey(id)}.png`;

// 產生／更新一筆：縮圖 png、tsj 那格、template；回傳 tile id
export async function syncPrefab(root, id, pf)
{
    const thumb = pf.thumb ?? DEF_THUMB;
    const cv = await renderThumb(pf, thumb);
    await FS.writeFile(await mkdirs(root, PNG_DIR), `${thumbKey(id)}.png`, await new Promise(res => cv.toBlob(res, 'image/png')));
    const t = await readTsj(root);
    let tile = t.data.tiles.find(x => x.image === imgPath(id));
    if (!tile)
    {
        tile = {id: Math.max(-1, ...t.data.tiles.map(x => x.id)) + 1, image: imgPath(id)};
        t.data.tiles.push(tile);
    }
    tile.imagewidth = cv.width;
    tile.imageheight = cv.height;
    await writeTsj(t);
    const dir = await mkdirs(root, TPL_DIR);
    const old = await readJson(dir, `${id}.tj`);
    const obj = old?.data?.object ?? {id: 1, name: '', type: 'item', rotation: 0, visible: true};
    const props = (obj.properties ?? []).filter(p => p.name !== 'prefab');
    Object.assign(obj, {gid: tile.id + 1, width: cv.width, height: cv.height, properties: [{name: 'prefab', type: 'string', value: id}, ...props]});
    await writeJson(dir, `${id}.tj`, {object: obj, tileset: {firstgid: 1, source: '../../tilesets/prefabs.tsj'}, type: 'template'}, old?.eol);
    return tile.id;
}

// 地圖／template 裡的引用（自己那個 template 沒有地圖在用就不算）
export async function prefabRefs(root, id)
{
    const assets = await tryPath(root, ASSETS);
    if (!assets) return {maps: [], tpls: []};
    const refs = await roleRefs(assets, id, 'prefab');
    return refs;
}

export const own = (id) => `templates/prefabs/${id}.tj`;
export const usedBy = (refs, id) => [...refs.maps.map(m => `${m.rel}：物件 ${m.oids.join('、')}`),
    ...refs.tpls.filter(t => t.rel !== own(id) || t.maps.length).map(t => (t.rel === own(id) ? `${t.maps.join('、')}（用 template）` : `${t.rel}（template）`))];

// 刪除：縮圖 png、tsj 那格、自己的 template（地圖有用的話呼叫端先擋）
export async function dropPrefab(root, id)
{
    const png = await tryPath(root, PNG_DIR);
    if (png && await FS.tryFile(png, `${thumbKey(id)}.png`)) await FS.removeFile(png, `${thumbKey(id)}.png`);
    const t = await readTsj(root);
    const n = t.data.tiles.length;
    t.data.tiles = t.data.tiles.filter(x => x.image !== imgPath(id));
    if (t.data.tiles.length !== n) await writeTsj(t);
    const tpl = await tryPath(root, TPL_DIR);
    if (tpl && await FS.tryFile(tpl, `${id}.tj`)) await FS.removeFile(tpl, `${id}.tj`);
}

// 改名：地圖物件／template 的 prefab 屬性、自己的 template 檔名（地圖裡指到它的路徑跟著改）、縮圖 png、tsj 那格的圖；回傳改了哪些檔
export async function renamePrefab(root, from, to)
{
    const assets = await tryPath(root, ASSETS);
    if (!assets) return [];
    const done = await renameRoleRefs(assets, await roleRefs(assets, from, 'prefab'), from, to, 'prefab');
    const tpl = await tryPath(root, TPL_DIR);
    if (tpl && await FS.tryFile(tpl, `${from}.tj`))
    {
        await FS.renameFile(tpl, `${from}.tj`, `${to}.tj`);
        done.push(own(to));
        // 地圖裡 template 路徑指到舊檔的物件改成新檔
        const maps = await tryPath(assets, 'maps');
        const walk = async (dir, pre) => {
            const {dirs, files} = await FS.listDir(dir);
            for (const f of files.filter(x => x.name.endsWith('.json')))
            {
                const rel = `${pre}${f.name}`, text = await (await f.getFile()).text();
                if (!text.includes(`${from}.tj`)) continue;
                const map = JSON.parse(text);
                let hit = false;
                for (const l of (map.layers ?? []).filter(x => x.type === 'objectgroup'))
                {
                    for (const o of l.objects)
                    {
                        if (!o.template || joinPath(rel.slice(0, rel.lastIndexOf('/')), o.template) !== own(from)) continue;
                        o.template = o.template.replace(/[^/]+\.tj$/, `${to}.tj`);
                        hit = true;
                    }
                }
                if (hit) {await FS.writeFile(dir, f.name, new Blob([stringify(map, eolOf(text))])); done.push(rel);}
            }
            for (const d of dirs) if (!d.name.startsWith('.')) await walk(d, `${pre}${d.name}/`);
        };
        if (maps) await walk(maps, 'maps/');
    }
    const png = await tryPath(root, PNG_DIR);
    if (png && await FS.tryFile(png, `${thumbKey(from)}.png`)) await FS.renameFile(png, `${thumbKey(from)}.png`, `${thumbKey(to)}.png`);
    const t = await readTsj(root);
    const tile = t.data.tiles.find(x => x.image === imgPath(from));
    if (tile) {tile.image = imgPath(to); await writeTsj(t);}
    return done;
}
