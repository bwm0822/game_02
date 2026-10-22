import { defineConfig } from 'vite';
import { resolve } from 'path';
import { run as genTextures } from '../scripts/textures.js';

const norm = (p) => p.replace(/\\/g, '/').toLowerCase();
const TEX = norm(resolve('public/assets/textures')) + '/';
const WATCH = /\.(png|jpe?g)$|_(sheet|atlas)\.json$/i;
const SKIP = /^(tbd|minimap|maps)\//;
const IMG = norm(resolve('images')) + '/';
const IMG_WATCH = /\.png$|\.pdproj\.json$/i;

function gen()
{
    try {return genTextures();}
    catch (e) {return {ok: false, errors: [e.message]};}
}

// 工具殼「更新圖片清單」按鈕＋textures/ 有變動自動重跑 scripts/textures.js，結果用 ws 'tools:textures' 推給殼
const toolsApi = {
    name: 'tools-api',
    configureServer(server)
    {
        server.middlewares.use('/__tools/textures', (req, res) => {
            if (req.method !== 'POST') {res.statusCode = 405; res.end(); return;}
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(gen()));
        });
        let timer;
        const onFile = (file) => {
            file = norm(file);
            if (!file.startsWith(TEX) || !WATCH.test(file) || SKIP.test(file.slice(TEX.length))) return;
            clearTimeout(timer);
            timer = setTimeout(() => server.ws.send({type: 'custom', event: 'tools:textures', data: gen()}), 300);
        };
        for (const ev of ['add', 'unlink', 'change']) server.watcher.on(ev, onFile);

        // 紙娃娃的工作資料夾 images/：300ms 內的變動合成一次，推 'tools:images' {dirs: 要重列的資料夾, changed: 內容改了的檔}（相對 images/）
        let imgTimer, dirs = new Set(), changed = new Set();
        const onImage = (ev, file) => {
            const p = file.replace(/\\/g, '/');
            if (!p.toLowerCase().startsWith(IMG)) return;
            const rel = p.slice(IMG.length), isDir = ev.endsWith('Dir');
            if (!rel || (!isDir && !IMG_WATCH.test(rel))) return;
            if (ev === 'change') changed.add(rel);
            else dirs.add(rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
            clearTimeout(imgTimer);
            imgTimer = setTimeout(() => {
                server.ws.send({type: 'custom', event: 'tools:images', data: {dirs: [...dirs], changed: [...changed]}});
                dirs = new Set();
                changed = new Set();
            }, 300);
        };
        for (const ev of ['add', 'unlink', 'change', 'addDir', 'unlinkDir']) server.watcher.on(ev, (file) => onImage(ev, file));
    },
};

export default defineConfig({
    base: './',
    plugins: [toolsApi],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: 8080
    }
});
