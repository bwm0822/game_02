// 地圖上的角色物件檢查（工具的地圖分頁、scripts/maps.js 共用）：type npc＋屬性 id 的物件
// 位置照 RoleView._setAnchor()：有大小的物件（tile 物件以左下為原點、其他以左上）＝左下角那一格的中心，點物件＝點本身＝root（站的那格）
import {buildGrid} from './navgrid.js';

// 工具畫角色、點選用的大概範圍：寬 FIG.w、高 FIG.h，中心在錨點＋(0, FIG.cy)（站在錨點那格、往上兩格高）
export const FIG = {w: 32, h: 64, cy: -16};

export const isRoleObj = (o) => o.type === 'npc' && o.props?.id != null && o.props.id !== '';
// 門＝type port＋屬性 map（要去的地圖，相對 maps/）、port（落腳點＝那張圖上同名的物件）
export const isPortObj = (o) => o.type === 'port' && o.props?.map != null && o.props.map !== '';

// namesOf(地圖名)＝那張圖的物件名稱 Set（地圖不存在／讀不到＝null）；地圖不存在＝錯誤、落腳點找不到＝警告、沒問題＝null
export function portIssue(o, namesOf)
{
    const map = String(o.props.map), to = String(o.props.port ?? ''), self = o.name ? `門「${o.name}」` : '門';
    const names = namesOf(map);
    if (!names) return {level: 'error', msg: `${self}指到不存在的地圖「${map}」`};
    if (!names.has(to)) return {level: 'warn', msg: `${self}的落腳點「${to}」在 ${map} 找不到`};
    return null;
}

// root＝錨點（站的那格的中心）；cen／w／h＝工具畫角色的大概範圍（FIG）
export function placeOf(o, tw = 32, th = 32)
{
    const w = o.width ?? 0, hh = o.height ?? 0;
    const bottom = o.gid ? o.y : o.y + hh;
    const root = w > 0 ? {x: o.x + tw / 2, y: bottom - th / 2} : {x: o.x, y: o.y};
    return {root, cen: {x: root.x, y: root.y + FIG.cy}, w: FIG.w, h: FIG.h};
}

// 不用格子就能查的：角色不存在（error）、玩家角色（error）、具名 NPC（warn，作息也會生出來）
export function roleIssues(rid, roles)
{
    const r = roles[rid];
    if (!r) return [{level: 'error', msg: `role.json 沒有角色「${rid}」`}];
    if (r.kind === 'player') return [{level: 'error', msg: `「${rid}」是玩家角色`}];
    if (r.kind === 'npc') return [{level: 'warn', msg: `「${rid}」是具名 NPC，作息也會生出來，遊戲裡可能出現兩個`}];
    return [];
}

// 物件（或它的 template）的 prefab 屬性指到 prefab.json 沒有的條目＝錯誤（docs/prefab.md）
export const isPrefabObj = (o) => o.props?.prefab != null && o.props.prefab !== '';
export function prefabIssue(o, prefabs)
{
    const id = String(o.props.prefab);
    return prefabs?.[id] ? null : {level: 'error', msg: `prefab.json 沒有「${id}」`};
}

// d＝navgrid 的 loadMap() 結果；回傳 [{level, oid（物件 id）, rid, tile, msg}]；grid 沒給就自己算（同路網：牆、物件佔住的格子＝0）
export function checkMapRoles(d, roles, grid = null)
{
    const out = [];
    const tw = d.map.tilewidth, th = d.map.tileheight;
    for (const o of d.objs)
    {
        if (!isRoleObj(o)) continue;
        const rid = String(o.props.id), {root} = placeOf(o, tw, th);
        const tile = [Math.floor(root.x / tw), Math.floor(root.y / th)];
        const add = (level, msg) => out.push({level, oid: o.id, rid, tile, msg});
        for (const x of roleIssues(rid, roles)) add(x.level, x.msg);
        if (tile[0] < 0 || tile[1] < 0 || tile[0] >= d.map.width || tile[1] >= d.map.height) {add('error', `站在地圖外（格 ${tile.join(',')}）`); continue;}
        grid ??= buildGrid(d.map, d.tilesets, d.objs);
        if (grid[tile[1]][tile[0]] === 0) add('warn', `站在擋住的格子（格 ${tile.join(',')}）`);
    }
    return out;
}
