//--------------------------------------------------
// 粒子特效：particle.json 的一筆＝Phaser ParticleEmitter config 原樣＋自己的欄位
//  img      : 'p-dot' 之類內建形狀(程式產生) | texture key('key' 或 'key:frame') | 其他字(emoji，畫成 'emoji:<字>' 快取，不吃 tint)
//  mode     : 'burst'(一次噴 count 顆，噴完自動銷毀) | 'stream'(持續噴，預設)
//  duration : stream 噴多久(ms)；呼叫端傳的優先，都沒有＝噴到 stop()
//  local    : true＝emitter 加進 parent(粒子跟著物件走)；預設 world＋follow(粒子留在原地自己飄)
//  depth    : 'under'＝畫在目標底下；預設最上層
//  x, y     : 發射點偏移
// 寫法友善：tint/color 可寫 '#ff6600'，blendMode 可寫 'ADD'，emitZone/deathZone 的 source 寫 {x,y,w,h}｜{x,y,r}｜{x1,y1,x2,y2}
// 遊戲跟特效／粒子工具的預覽共用，不 import DB(呼叫端自己查 DB.particle(id))
//--------------------------------------------------

export const BUILTIN = ['p-dot', 'p-soft', 'p-spark', 'p-square', 'p-ring'];
const OWN = ['img', 'mode', 'count', 'duration', 'local', 'depth', 'x', 'y'];
const EMOJI_SIZE = 32;

// 內建形狀畫成白色 canvas(遊戲加成貼圖、工具拿來顯示)
export function builtinCanvas(key)
{
    const S = {'p-dot':8, 'p-soft':32, 'p-spark':[16,4], 'p-square':8, 'p-ring':16}[key];
    const [w, h] = Array.isArray(S) ? S : [S, S];
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff';
    switch(key)
    {
        case 'p-dot': c.beginPath(); c.arc(w/2, h/2, w/2, 0, Math.PI*2); c.fill(); break;
        case 'p-soft':
        {
            const g = c.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
            break;
        }
        case 'p-spark':
        {
            const g = c.createLinearGradient(0, 0, w, 0);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(1, 'rgba(255,255,255,1)');
            c.fillStyle = g;
            c.beginPath(); c.ellipse(w/2, h/2, w/2, h/2, 0, 0, Math.PI*2); c.fill();
            break;
        }
        case 'p-square': c.fillRect(0, 0, w, h); break;
        case 'p-ring': c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(w/2, h/2, w/2-1, 0, Math.PI*2); c.stroke(); break;
    }
    return cv;
}

const drawBuiltin = (scene, key)=>scene.textures.addCanvas(key, builtinCanvas(key));

function drawEmoji(scene, key, text)
{
    const tex = scene.textures.createCanvas(key, EMOJI_SIZE, EMOJI_SIZE);
    const c = tex.context;
    c.font = `${Math.floor(EMOJI_SIZE*0.85)}px sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, EMOJI_SIZE/2, EMOJI_SIZE/2 + EMOJI_SIZE*0.05);
    tex.refresh();
}

// img → {key, frame, emoji}；需要的貼圖第一次用到才產生
export function particleTexture(scene, img='p-dot')
{
    if(BUILTIN.includes(img))
    {
        if(!scene.textures.exists(img)) {drawBuiltin(scene, img);}
        return {key:img};
    }
    const [key, frame] = String(img).split(':');
    if(scene.textures.exists(key)) {return {key, frame};}
    const ek = `emoji:${img}`;
    if(!scene.textures.exists(ek)) {drawEmoji(scene, ek, img);}
    return {key:ek, emoji:true};
}

const color = (v)=>typeof v==='string' ? parseInt(v.replace(/^#/, ''), 16) : v;
const colors = (v)=>{
    if(Array.isArray(v)) {return v.map(color);}
    if(v && typeof v==='object')
    {
        const o = {...v};
        for(const k of ['start', 'end', 'min', 'max']) {if(k in o) {o[k] = color(o[k]);}}
        if(Array.isArray(o.random)) {o.random = o.random.map(color);}
        return o;
    }
    return color(v);
};

function geom(src)
{
    if(!src || typeof src.getRandomPoint==='function') {return src;}
    const G = Phaser.Geom;
    if('r' in src) {return new G.Circle(src.x ?? 0, src.y ?? 0, src.r);}
    if('x1' in src) {return new G.Line(src.x1, src.y1, src.x2, src.y2);}
    if('w' in src) {return new G.Rectangle(src.x ?? -src.w/2, src.y ?? -src.h/2, src.w, src.h);}
    return src;
}

const zone = (z)=>{
    if(!z) {return z;}
    if(Array.isArray(z)) {return z.map(zone);}
    return {...z, source:geom(z.source)};
};

// def(particle.json 一筆) → Phaser 的 emitter config(不含自己的欄位)
export function emitterConfig(def={}, {emoji=false}={})
{
    const cfg = {};
    for(const [k, v] of Object.entries(def)) {if(!OWN.includes(k)) {cfg[k] = v;}}
    if(emoji) {delete cfg.tint; delete cfg.color;}
    if('tint' in cfg) {cfg.tint = colors(cfg.tint);}
    if('color' in cfg) {cfg.color = colors(cfg.color);}
    if(typeof cfg.blendMode==='string') {cfg.blendMode = Phaser.BlendModes[cfg.blendMode.toUpperCase()] ?? cfg.blendMode;}
    if(cfg.emitZone) {cfg.emitZone = zone(cfg.emitZone);}
    if(cfg.deathZone) {cfg.deathZone = zone(cfg.deathZone);}
    return cfg;
}

//--------------------------------------------------
// 播一個粒子：回傳 ParticleFx(def 是空的回傳 null)
//  opts.x, y      : 沒有 target/parent 時的世界座標
//  opts.target    : 跟著誰(world＝startFollow；目標 active 變 false 或離開場景就自動 stop)
//  opts.parent    : local 模式加進哪個 container(沒給＝target)
//  opts.ox, oy    : 額外偏移(疊在 def.x/y 上)
//  opts.duration  : 蓋掉 def.duration
//  opts.count     : 蓋掉 def.count
//  opts.area      : {w, h, cells}：發射範圍改成以發射點為中心的 w×h 矩形，quantity/count 乘 cells(區域特效用)
//  opts.depth     : 數字，蓋掉預設深度
//--------------------------------------------------
export function playParticle(scene, def, opts={})
{
    if(!def) {return null;}
    return new ParticleFx(scene, def, opts);
}

export class ParticleFx
{
    constructor(scene, def, opts={})
    {
        this.scene = scene;
        this.def = def;
        const {target=null, ox=0, oy=0, area=null} = opts;
        const mode = def.mode==='burst' ? 'burst' : 'stream';
        const local = !!def.local;
        const parent = local ? (opts.parent ?? target) : null;
        const dx = (def.x ?? 0) + ox, dy = (def.y ?? 0) + oy;
        const tex = particleTexture(scene, def.img);
        const cfg = emitterConfig(def, tex);
        if(tex.frame !== undefined) {cfg.frame = tex.frame;}
        const cells = area?.cells ?? 1;
        if(area) {cfg.emitZone = {type:'random', source:new Phaser.Geom.Rectangle(-area.w/2, -area.h/2, area.w, area.h)};}
        if(mode==='burst') {cfg.emitting = false;}
        else
        {
            const duration = opts.duration ?? def.duration;
            if(duration > 0) {cfg.duration = duration;}
            if(cells > 1) {cfg.quantity = (typeof cfg.quantity==='number' ? cfg.quantity : 1) * cells;}
        }

        // follow 時粒子出生在 target＋followOffset，再套 emitter 自己的 transform，所以 emitter 要放 0,0
        const [x, y] = parent ? [dx, dy]
                     : target ? [0, 0]
                     : [(opts.x ?? 0) + dx, (opts.y ?? 0) + dy];
        const em = this.emitter = scene.add.particles(x, y, tex.key, cfg);
        this.target = target;
        this.under = def.depth==='under';
        if(parent) {parent.add(em); if(this.under) {parent.sendToBack(em);}}
        else
        {
            if(target) {em.startFollow(target, dx, dy);}
            em.setDepth(opts.depth ?? (this.under ? (target?.depth ?? 0) - 0.5 : Infinity));
        }

        this.done = new Promise(res=>{this._resolve = res;});
        this._started = mode==='stream';
        this._update = ()=>this._tick();
        this._shutdown = ()=>this.stop(true);
        scene.events.on('update', this._update);
        scene.events.once('shutdown', this._shutdown);
        em.once(Phaser.GameObjects.Events.DESTROY, ()=>this._cleanup());

        if(mode==='burst')
        {
            em.explode((opts.count ?? def.count ?? 10) * cells);
            this._started = true;
        }
    }

    get alive() {return this.emitter?.active ? this.emitter.getAliveParticleCount() : 0;}

    _tick()
    {
        const em = this.emitter;
        if(!em?.active) {return;}
        const t = this.target;
        if(t && em.emitting && (!t.active || !t.scene)) {this.stop();}
        else if(t && this.under && !em.parentContainer) {em.setDepth((t.depth ?? 0) - 0.5);}
        if(this._started && !em.emitting && em.getAliveParticleCount()===0) {em.destroy();}
    }

    // kill=false：停止發射、剩下的飄完才銷毀；true：立刻全部清掉
    stop(kill=false)
    {
        const em = this.emitter;
        if(!em?.active) {return;}
        em.stop(kill);
        if(kill) {em.destroy();}
    }

    _cleanup()
    {
        this.scene.events.off('update', this._update);
        this.scene.events.off('shutdown', this._shutdown);
        this.emitter = null;
        this._resolve?.();
        this._resolve = null;
    }
}
