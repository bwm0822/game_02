import { defineConfig } from 'vite';
import { run as genTextures } from '../scripts/textures.js';

// 工具殼「更新圖片清單」按鈕：dev server 重跑 scripts/textures.js
const toolsApi = {
    name: 'tools-api',
    configureServer(server)
    {
        server.middlewares.use('/__tools/textures', (req, res) => {
            if (req.method !== 'POST') {res.statusCode = 405; res.end(); return;}
            let r;
            try {r = genTextures();}
            catch (e) {r = {ok: false, errors: [e.message]};}
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(r));
        });
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
