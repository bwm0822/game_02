// 無頭瀏覽器測試的共用工具：自己開 vite dev server + 無頭 Chrome，透過 src/main.js 掛的 window.__dbg 操作遊戲
// 只印文字結果，不截圖；失敗時才把畫面存到 scripts/test/out/
import {createServer} from 'vite'
import puppeteer from 'puppeteer-core'
import fs from 'fs'

const CHROME = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p));

const OUT = './scripts/test/out';

export async function run(name, scenario)
{
    const server = await createServer({configFile:'vite/config.dev.mjs', server:{port:5190}, logLevel:'error'});
    await server.listen();
    const url = server.resolvedUrls.local[0];
    const browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: true,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    });
    const page = await browser.newPage();
    await page.setViewport({width:1024, height:768});

    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});

    const t = new Tester(page, errors);
    console.log(`▶ ${name}`);
    try
    {
        await page.goto(url);
        await scenario(t);
    }
    catch (e)
    {
        t.fail(`中斷：${e.message}`);
    }
    if (errors.length) t.fail(`console 錯誤 ${errors.length} 個：\n    ${[...new Set(errors)].slice(0, 5).join('\n    ')}`);
    if (t.failed)
    {
        fs.mkdirSync(OUT, {recursive:true});
        const shot = `${OUT}/${name}.png`;
        await page.screenshot({path:shot}).catch(() => {});
        console.log(`  畫面存到 ${shot}`);
    }
    console.log(t.failed ? `✘ ${name}：${t.failed} 個失敗` : `✔ ${name}：全部通過`);
    await browser.close();
    await server.close();
    process.exitCode = t.failed ? 1 : 0;
}

class Tester
{
    constructor(page, errors) {this.page = page; this.errors = errors; this.failed = 0;}

    ok(msg) {console.log(`  ✔ ${msg}`);}
    fail(msg) {this.failed++; console.log(`  ✘ ${msg}`);}
    check(msg, cond, detail='') {cond ? this.ok(msg) : this.fail(`${msg}${detail ? `（${detail}）` : ''}`);}
    eq(msg, actual, expect) {this.check(msg, actual === expect, `實際 ${JSON.stringify(actual)}，預期 ${JSON.stringify(expect)}`);}

    // 在頁面裡執行，fn 拿到 window.__dbg 和額外參數
    // d.objs()：目前地圖的所有物件（角色在 scene.roles，其他在 scene.gos）
    eval(fn, ...args)
    {
        return this.page.evaluate((src, args) => {
            const d = window.__dbg;
            d.objs = () => {const gs = d.game.scene.getScene('GameScene'); return [...new Set([...(gs.roles ?? []), ...Object.values(gs.gos ?? {})])];};
            return new Function('d', 'args', `return (${src})(d, ...args)`)(d, args);
        }, fn.toString(), args);
    }

    async waitFor(fn, {timeout=20000, what='條件'}={}, ...args)
    {
        const end = Date.now() + timeout;
        while (Date.now() < end)
        {
            if (await this.eval(fn, ...args).catch(() => false)) return;
            await new Promise(r => setTimeout(r, 200));
        }
        throw new Error(`等待逾時：${what}`);
    }

    // 主選單 → 開新遊戲，等到起始地圖載入完成
    async newGame()
    {
        await this.waitFor(d => d?.game.scene.isActive('MainMenu'), {what:'主選單'});
        await this.eval(d => d.game.scene.getScene('MainMenu').scene.start('Game'));
        await this.waitReady(await this.eval(d => d.Record.game_def.map));
    }

    async waitReady(map)
    {
        await this.waitFor((d, map) => {
            const gs = d.game.scene.getScene('GameScene');
            return gs?.sys.isActive() && gs._data?.map === map && d.GM.player?.scene === gs;
        }, {what:`地圖 ${map} 載入`}, map);
    }

    // 直接切地圖（不走路），沒給 port 就放在地圖中心
    async gotoMap(map)
    {
        await this.eval((d, map) => d.game.scene.getScene('GameScene').gotoScene({map}), map);
        await this.waitReady(map);
    }

    q(name) {return this.eval((d, name) => d.Quality.get(name), name);}
    setQ(name, v) {return this.eval((d, name, v) => d.Quality.set(name, v), name, v);}

    // 目前地圖上活著的某種角色
    count(id) {return this.eval((d, id) => d.objs().filter(g => g.id === id && g.isAlive !== false).length, id);}

    // 走 UI 的路徑對話：npc.talk() 開對話框，再照順序點選項；回傳每一步 NPC 說的話
    talk(npc, ...labels)
    {
        return this.eval((d, npc, labels) => {
            const gs = d.game.scene.getScene('GameScene');
            const who = d.objs().find(g => g.id === npc);
            if (!who) throw new Error(`地圖上找不到 ${npc}`);
            who.talk();
            const dlg = d.Ui.get(d.UI.TAG.DIALOG);
            const said = [dlg.dialog.A];
            for (const l of labels)
            {
                const opt = dlg.dialog.B.find(b => b.text === l);
                if (!opt) throw new Error(`${npc} 沒有選項「${l}」，目前：${dlg.dialog.B.map(b => b.text).join('/')}`);
                dlg.owner.select(opt, dlg.cb.bind(dlg));
                said.push(dlg.dialog.A);
            }
            dlg.close();
            return said;
        }, npc, labels);
    }

    // 不戰鬥，直接走傷害流程打死（死亡事件跟真的打死一樣）
    kill(id)
    {
        return this.eval((d, id) => {
            const gs = d.game.scene.getScene('GameScene');
            const list = d.objs().filter(g => g.id === id && g.isAlive !== false);
            list.forEach(g => g.takeDamage({amount:-99999}, d.GM.player));
            return list.length;
        }, id);
    }

    give(id, count=1) {return this.eval((d, id, count) => d.GM.player.reward([{type:'item', id, count}]), id, count);}

    journal(id) {return this.eval((d, id) => d.Story.thread(id), id);}
}
