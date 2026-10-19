import { defineConfig } from 'vite';
import path from 'path';
import { dropTbd } from './droptbd.mjs';

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = "---------------------------------------------------------";
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);
            
            process.stdout.write(`✨ Done ✨\n`);
        }
    }
}   

export default defineConfig({
    base: './',
    logLevel: 'warning',
    build: {
        outDir: path.resolve(__dirname, '../dist'),
        emptyOutDir: true,
    },
    server: {
        port: 8080
    },
    plugins: [
        phasermsg(),
        dropTbd()
    ]
});
