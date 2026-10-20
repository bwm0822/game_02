import { defineConfig } from 'vite';
import { resolve } from 'path';
import { run as genTextures } from '../scripts/textures.js';

const norm = (p) => p.replace(/\\/g, '/').toLowerCase();
const TEX = norm(resolve('public/assets/textures')) + '/';
const WATCH = /\.(png|jpe?g)$|_(sheet|atlas)\.json$/i;
const SKIP = /^(tbd|minimap|maps)\//;

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
