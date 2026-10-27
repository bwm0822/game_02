// 武器動畫(anim.json)的姿勢數學(純函式、不碰 Phaser)：COM_Anim 用 tween 推時間，tools/fit 用滑桿推，兩邊算出來一樣
// 座標都是 shape 本地(面向右)，面向左時 shape 已鏡像；姿勢是武器 sprite 的 {x, y, angle}(位置＝原點 ox/oy 所在)
// anim: {follow, pivot:{x,y}, ready, hit, back, hold, keys:[{t, x, y, a, ease, path}]}，t/ready/hit/back 單位 ms

export const BACK_EASE = 'Quad.Out';

const rad = (deg)=>deg*Math.PI/180;
const deg = (r)=>r*180/Math.PI;
const lerp = (a, b, t)=>a + (b - a)*t;

// 曲線名稱跟公式照 Phaser.Math.Easing，fx.json(直接給 Phaser tween)跟 anim.json 共用同一份清單
const pow = (p)=>({In:(t)=>t**p, Out:(t)=>1 - (1 - t)**p, InOut:(t)=>t<0.5 ? (2*t)**p/2 : 1 - (2 - 2*t)**p/2});
const bounceOut = (t)=>
{
    if(t < 1/2.75) {return 7.5625*t*t;}
    if(t < 2/2.75) {t -= 1.5/2.75; return 7.5625*t*t + 0.75;}
    if(t < 2.5/2.75) {t -= 2.25/2.75; return 7.5625*t*t + 0.9375;}
    t -= 2.625/2.75; return 7.5625*t*t + 0.984375;
};
const BK = 1.70158, BK2 = BK*1.525, EP = 0.1, ES = EP/4;
const elastic = (t)=>Math.sin((t - ES)*2*Math.PI/EP);
const FAMILY = {
    Quad: pow(2), Cubic: pow(3), Quart: pow(4), Quint: pow(5),
    Sine: {In:(t)=>1 - Math.cos(t*Math.PI/2), Out:(t)=>Math.sin(t*Math.PI/2), InOut:(t)=>(1 - Math.cos(Math.PI*t))/2},
    Expo: {In:(t)=>2**(10*(t - 1)) - 0.001, Out:(t)=>1 - 2**(-10*t),
        InOut:(t)=>t<0.5 ? 2**(10*(2*t - 1))/2 : (2 - 2**(-10*(2*t - 1)))/2},
    Circ: {In:(t)=>1 - Math.sqrt(1 - t*t), Out:(t)=>Math.sqrt(1 - (t - 1)**2),
        InOut:(t)=>t<0.5 ? (1 - Math.sqrt(1 - 4*t*t))/2 : (Math.sqrt(1 - (2*t - 2)**2) + 1)/2},
    Back: {In:(t)=>t*t*((BK + 1)*t - BK), Out:(t)=>(t - 1)**2*((BK + 1)*(t - 1) + BK) + 1,
        InOut:(t)=>t<0.5 ? (2*t)**2*((BK2 + 1)*2*t - BK2)/2 : ((2*t - 2)**2*((BK2 + 1)*(2*t - 2) + BK2) + 2)/2},
    Elastic: {In:(t)=>t<=0 || t>=1 ? t : -(2**(10*(t - 1))*elastic(t - 1)),
        Out:(t)=>t<=0 || t>=1 ? t : 2**(-10*t)*elastic(t) + 1,
        InOut:(t)=>t<=0 || t>=1 ? t : t<0.5 ? -(2**(10*(2*t - 1))*elastic(2*t - 1))/2 : 2**(-10*(2*t - 1))*elastic(2*t - 1)/2 + 1},
    Bounce: {In:(t)=>1 - bounceOut(1 - t), Out:bounceOut, InOut:(t)=>t<0.5 ? (1 - bounceOut(1 - 2*t))/2 : (bounceOut(2*t - 1) + 1)/2},
};
const linear = (t)=>t;
export const EASE = {
    Linear: linear, Stepped: (t)=>t<=0 ? 0 : 1,
    Power0: linear, Power1: FAMILY.Quad.Out, Power2: FAMILY.Cubic.Out, Power3: FAMILY.Quart.Out, Power4: FAMILY.Quint.Out,
    ...Object.fromEntries(Object.entries(FAMILY).flatMap(([n, f])=>Object.entries(f).map(([d, fn])=>[`${n}.${d}`, fn]))),
};

// 同 Phaser.Math.Angle.ShortestBetween：b-a 換到 [-180, 180)
export function shortest(a, b)
{
    const d = b - a;
    if(d===0) {return 0;}
    return d - Math.floor((d + 180)/360)*360;
}

// 目標方向(度)；sign 是 shape.scaleX 的正負
export const dirTo = (dx, dy, sign=1)=>Math.atan2(dy, dx*sign)*180/Math.PI;

export const animEnd = (anim)=>anim.keys.at(-1)?.t ?? 0;

// 把動畫攤成一串影格：第 0 格是 from(當下姿勢)，最後補一格收回 rest；follow 的影格繞 pivot 轉 dir 度
// 進第一格跟收回用最短角度(兩端不是編輯出來的姿勢)，中間影格照數字 lerp，所以轉向由數字決定
export function animTrack(anim, from, rest=from, dir=0)
{
    const pivot = anim.pivot ?? {x:0, y:0};
    const rot = anim.follow ? dir : 0;
    const [c, s] = [Math.cos(rad(rot)), Math.sin(rad(rot))];
    const keys = anim.keys.map((k)=>{
        const [dx, dy] = [k.x - pivot.x, k.y - pivot.y];
        return {t:k.t, x:pivot.x + dx*c - dy*s, y:pivot.y + dx*s + dy*c, angle:k.a + rot, ease:k.ease, path:k.path};
    });
    if(keys.length)
    {
        const off = from.angle + shortest(from.angle, keys[0].angle) - keys[0].angle;
        keys.forEach((k)=>{k.angle += off;});
    }
    const last = keys.at(-1) ?? {t:0, angle:from.angle};
    const end = animEnd(anim);
    const back = {t:end + (anim.back ?? 0), x:rest.x, y:rest.y, angle:last.angle + shortest(last.angle, rest.angle), ease:BACK_EASE};
    return {pivot, end, frames:[{t:0, x:from.x, y:from.y, angle:from.angle}, ...keys, back]};
}

export const trackEnd = (track)=>track.frames.at(-1).t;

// arc：握把繞 pivot 做極座標補間，繞的方向跟武器角度變化同向(角度沒變就走最短)
function arcAt(p, k0, k1, e)
{
    const a0 = deg(Math.atan2(k0.y - p.y, k0.x - p.x));
    let d = shortest(a0, deg(Math.atan2(k1.y - p.y, k1.x - p.x)));
    const turn = k1.angle - k0.angle;
    if(turn>0 && d<0) {d += 360;}
    else if(turn<0 && d>0) {d -= 360;}
    const r = lerp(Math.hypot(k0.x - p.x, k0.y - p.y), Math.hypot(k1.x - p.x, k1.y - p.y), e);
    const a = rad(a0 + d*e);
    return {x:p.x + Math.cos(a)*r, y:p.y + Math.sin(a)*r};
}

export function poseAt(track, ms)
{
    const fs = track.frames;
    let i = 1;
    while(i < fs.length - 1 && ms > fs[i].t) {i++;}
    const [k0, k1] = [fs[i-1], fs[i]];
    const u = k1.t > k0.t ? Math.min(1, Math.max(0, (ms - k0.t)/(k1.t - k0.t))) : 1;
    const e = (EASE[k1.ease] ?? EASE.Linear)(u);
    const pos = k1.path==='arc' ? arcAt(track.pivot, k0, k1, e) : {x:lerp(k0.x, k1.x, e), y:lerp(k0.y, k1.y, e)};
    return {...pos, angle:lerp(k0.angle, k1.angle, e)};
}
