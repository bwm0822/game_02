import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import sharp from 'sharp';

// 讀 map.world，把每張地圖用 tmxrasterizer 縮圖成小地圖 png，供拼總覽地圖用
// 用法：node scripts/minimap.js
// 需求：系統要能找到 tmxrasterizer(隨 Tiled 安裝，Windows 通常在 Tiled 安裝資料夾底下）
//      找不到的話用環境變數指定路徑，例如：
//      $env:TMXRASTERIZER = 'C:\Program Files\Tiled\tmxrasterizer.exe'; node scripts/minimap.js

const TMXRASTERIZER = process.env.TMXRASTERIZER || 'tmxrasterizer';

// tmxrasterizer 的 --tilesize/--size 只吃整數，沒辦法直接縮到任意比例（例如小於 1px/格）。
// 做法：先用一個夠高的整數 tilesize 讓 tmxrasterizer 畫出「高解析度原圖」，
// 再用 sharp 把原圖二次縮放到真正想要的任意尺寸（可以是小數比例、不受整數限制）。
const SOURCE_TILE_PX = 8;

// 輸出圖片「長邊」要縮成幾像素，可以是任意值（不受 tmxrasterizer 只吃整數的限制）。
// 地圖的寬/高比例會依實際 tile 數（width/height）等比例縮放，長邊對齊這個值、短邊照比例算，
// 所有地圖共用同一個值，縮圖跟 main.world/map.world 的相對位置才不會走樣。
const OUTPUT_SIZE = 100;

// 只畫圖層名稱以此開頭的圖層（不分大小寫），其餘圖層一律排除
// tmxrasterizer 沒有「只顯示」選項，靠先讀出地圖實際圖層、把不符合前綴的都丟進 --hide-layer 做到
const SHOW_LAYER_PREFIX = 'map';

const WORLD_PATH = './public/assets/maps/main.world';
const OUT_DIR = './public/assets/textures/minimap';

// 讀地圖 json，回傳地圖的 tile 寬高，以及「名稱不是以 SHOW_LAYER_PREFIX 開頭」的圖層名稱清單（要被排除的）
function getMapInfo(mapPath)
{
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    const prefix = SHOW_LAYER_PREFIX.toLowerCase();
    const hideLayers = map.layers
        .filter(l => !(l.name ?? '').toLowerCase().startsWith(prefix))
        .map(l => l.name);
    return { width: map.width, height: map.height, hideLayers };
}

async function main()
{
    const world = JSON.parse(fs.readFileSync(WORLD_PATH, 'utf-8'));

    fs.mkdirSync(OUT_DIR, { recursive: true });

    let ok = 0, fail = 0;

    for (const m of world.maps)
    {
        const input = path.join('./public/assets/maps', m.fileName);
        const output = path.join(OUT_DIR, m.fileName.replace(/\.json$/, '.png'));
        const rawOutput = output.replace(/\.png$/, '.raw.png');

        try
        {
            const { width, height, hideLayers } = getMapInfo(input);
            const hideArgs = hideLayers.flatMap(name => ['--hide-layer', name]);

            // 1) 用整數 tilesize 畫出高解析度原圖
            execFileSync(TMXRASTERIZER, ['--tilesize', String(SOURCE_TILE_PX), ...hideArgs, input, rawOutput]);

            // 2) 用 sharp 二次縮放：長邊對齊 OUTPUT_SIZE，短邊依地圖寬高比例算，任意數值都可以
            const scale = OUTPUT_SIZE / Math.max(width, height);
            const targetW = Math.max(1, Math.round(width * scale));
            const targetH = Math.max(1, Math.round(height * scale));
            await sharp(rawOutput).resize(targetW, targetH).toFile(output);
            fs.unlinkSync(rawOutput);

            console.log(`OK   ${m.fileName} -> ${output} (${targetW}x${targetH})`);
            ok++;
        }
        catch (err)
        {
            console.error(`FAIL ${m.fileName}: ${err.message}`);
            fail++;
        }
    }

    console.log(`\n完成：${ok} 張成功，${fail} 張失敗`);
}

main();
