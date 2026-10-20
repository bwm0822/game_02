// 武器瞄準／揮砍的姿勢數學(純函式、不碰 Phaser)：COM_Anim 用 tween 推 t，tools/fit 用滑桿推 t，兩邊算出來一樣
// 座標都是 shape 本地(面向右)，面向左時 shape 已鏡像
// sp 只讀 {x, y, angle, width, height, originX, originY, scaleX, scaleY, displayHeight}，回傳的姿勢是 {x, y, angle}

const SWING = {LIFT:12, RAISE:-90, ARM:6, CHOP:120, SWEEP:180, SWEEP_ARM:14};
export const AIM = {duration:60, ease:'quad.out'};

const rad = (deg)=>deg*Math.PI/180;
const lerp = (a, b, t)=>a + (b - a)*t;
const lerpG = (from, to, t)=>({x:lerp(from.x, to.x, t), y:lerp(from.y, to.y, t)});

// 同 Phaser.Math.Angle.ShortestBetween：b-a 換到 [-180, 180)
export function shortest(a, b)
{
    const d = b - a;
    if(d===0) {return 0;}
    return d - Math.floor((d + 180)/360)*360;
}

// 目標方向(度)；sign 是 shape.scaleX 的正負
export const dirTo = (dx, dy, sign=1)=>Math.atan2(dy, dx*sign)*180/Math.PI;

// 瞄準：以圖片中心為支點旋轉(origin 是底部中心，所以 x/y 要補償)；base 是瞄準前的 {x, y, angle}，deg 為 null 表示還原
export function aimPose(sp, base, aim, deg=null)
{
    const to = deg==null ? base.angle : sp.angle + shortest(sp.angle, deg - aim);
    const h = sp.displayHeight/2;
    const r0 = rad(base.angle);
    const [cx, cy] = [base.x + Math.sin(r0)*h, base.y - Math.cos(r0)*h];
    const a0 = sp.angle;
    return (t)=>{
        const angle = lerp(a0, to, t);
        const r = rad(angle);
        return {x:cx - Math.sin(r)*h, y:cy + Math.cos(r)*h, angle};
    };
}

// grip 是圖格內握柄像素座標(左上為原點)，轉 angle 度後相對 sprite 位置的偏移
function gripOffset(sp, grip, angle)
{
    const ox = (grip.x - sp.width*sp.originX) * sp.scaleX;
    const oy = (grip.y - sp.height*sp.originY) * sp.scaleY;
    const r = rad(angle);
    return [ox*Math.cos(r) - oy*Math.sin(r), ox*Math.sin(r) + oy*Math.cos(r)];
}

export function gripAt(sp, grip)
{
    const [dx, dy] = gripOffset(sp, grip, sp.angle);
    return {x:sp.x+dx, y:sp.y+dy};
}

// 握把在 g、轉 angle 度時 sprite 的姿勢
export function swingPlace(sp, grip, g, angle)
{
    const [dx, dy] = gripOffset(sp, grip, angle);
    return {x:g.x - dx, y:g.y - dy, angle};
}

// phase: 'raise' 握把上提、劍繞握把往後轉；'strike' 手臂(軸心→握把)繞軸心往前砍，劍同時甩到跟手臂一直線；null 收回原狀
// 'sweepRaise' 手臂(角色中心→握把)跟劍連成一直線，轉到 dir -90°；'sweep' 從那裡順時針掃 180°
// raise/strike 姿勢固定，不看目標方向；base 是揮砍前的 {g:握把位置, angle}
export function swingPose(phase, sp, {aim, grip}, base, dir=null)
{
    const [g0, a0] = [gripAt(sp, grip), sp.angle];
    let pose, duration, ease;
    if(phase==='raise')
    {
        const g1 = {x:base.g.x, y:base.g.y - SWING.LIFT};
        const a1 = a0 + shortest(a0, base.angle + SWING.RAISE);
        pose = (t)=>[lerpG(g0, g1, t), lerp(a0, a1, t)];
        [duration, ease] = [120, 'quad.out'];
    }
    else if(phase==='strike')
    {
        const p = {x:base.g.x, y:base.g.y - SWING.LIFT + SWING.ARM};
        const end = -90 + SWING.CHOP;
        const a1 = a0 + ((((end - aim) - a0) % 360) + 360) % 360;   // 劍順時針甩到跟手臂一直線
        pose = (t)=>{
            const r = rad(-90 + SWING.CHOP*t);
            return [{x:p.x + Math.cos(r)*SWING.ARM, y:p.y + Math.sin(r)*SWING.ARM}, lerp(a0, a1, t)];
        };
        [duration, ease] = [80, 'cubic.in'];
    }
    else if(phase==='sweepRaise' || phase==='sweep')
    {
        const from = dir - SWING.SWEEP/2;
        const arm = (deg)=>{
            const r = rad(deg);
            return {x:Math.cos(r)*SWING.SWEEP_ARM, y:Math.sin(r)*SWING.SWEEP_ARM};
        };
        if(phase==='sweepRaise')
        {
            const a1 = a0 + shortest(a0, from - aim);
            pose = (t)=>[lerpG(g0, arm(from), t), lerp(a0, a1, t)];
            [duration, ease] = [120, 'quad.out'];
        }
        else
        {
            pose = (t)=>[arm(from + SWING.SWEEP*t), a0 + SWING.SWEEP*t];
            [duration, ease] = [300, 'cubic.in'];
        }
    }
    else
    {
        const a1 = a0 + shortest(a0, base.angle);
        pose = (t)=>[lerpG(g0, base.g, t), lerp(a0, a1, t)];
        [duration, ease] = [150, 'quad.out'];
    }
    return {pose:(t)=>swingPlace(sp, grip, ...pose(t)), duration, ease};
}
