import fs from 'fs';
import path from 'path';

// public/assets/textures/tbd 是還沒用到的圖，開發時留著看，正式版不打包
export const dropTbd = () => {
    let outDir;
    return {
        name: 'drop-tbd',
        apply: 'build',
        configResolved(config) {
            outDir = path.resolve(config.root, config.build.outDir);
        },
        closeBundle() {
            fs.rmSync(path.join(outDir, 'assets/textures/tbd'), { recursive: true, force: true });
        }
    }
}
