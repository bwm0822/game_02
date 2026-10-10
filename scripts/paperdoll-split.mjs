#!/usr/bin/env node

/**
 * 素體圖拆件：去掉假棋盤格背景，輸出去背的 base-mannequin.png 與切掉頭的 body-chibi.png
 * 用法: node scripts/paperdoll-split.mjs <輸入圖> [輸出目錄]
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const isBg = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) < 16 && Math.min(r, g, b) > 160;
const isDark = (r, g, b) => r + g + b < 250;

function removeBackground(data, W, H) {
    const seen = new Uint8Array(W * H);
    const stack = [];
    for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
    while (stack.length) {
        const p = stack.pop();
        if (seen[p]) continue;
        const i = p * 4;
        if (!isBg(data[i], data[i + 1], data[i + 2])) continue;
        seen[p] = 1;
        data[i + 3] = 0;
        const x = p % W;
        if (x > 0) stack.push(p - 1);
        if (x < W - 1) stack.push(p + 1);
        if (p >= W) stack.push(p - W);
        if (p < W * (H - 1)) stack.push(p + W);
    }
}

// 頭跟軀幹之間沒有脖子，下巴輪廓線就是軀幹上緣：band 以上全清，band 內每欄清到第一個深色輪廓像素
function removeHead(data, W, H) {
    const top = Math.floor(H * 0.45), bottom = Math.floor(H * 0.55);
    const dark = (x, y) => {
        const i = (y * W + x) * 4;
        return data[i + 3] && isDark(data[i], data[i + 1], data[i + 2]);
    };
    for (let x = 0; x < W; x++) {
        let cut = top;
        for (let y = top; y < bottom; y++) {
            if (!dark(x, y)) continue;
            let e = y;
            while (e + 1 < H && dark(x, e + 1)) e++;
            // 長段是直立的下顎線，只留最下面跟軀幹接起來的那截；下面沒東西代表整段都是頭
            cut = data[((e + 1) * W + x) * 4 + 3] ? Math.max(y, e - 10) : e + 1;
            break;
        }
        for (let y = 0; y < cut; y++) data[(y * W + x) * 4 + 3] = 0;
    }
}

async function save(data, W, H, file) {
    await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } }).trim().png().toFile(file);
    console.log(`✅ ${file}`);
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        console.error('用法: node scripts/paperdoll-split.mjs <輸入圖> [輸出目錄]');
        process.exit(1);
    }
    const outDir = process.argv[3] || path.join(projectRoot, 'public/assets/roles_64x64');
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;

    removeBackground(data, W, H);
    const full = Buffer.from(data);
    removeHead(data, W, H);

    await save(full, W, H, path.join(outDir, 'base-mannequin.png'));
    await save(data, W, H, path.join(outDir, 'body-chibi.png'));
}

main();
