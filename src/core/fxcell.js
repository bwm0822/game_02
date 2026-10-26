import {Pic} from '../ui/uicomponents.js'

//--------------------------------------------------
// 類別 : 單格特效動畫
// 功能 :
//  anim = {cell, spawn, idle, tick, end}，spawn/idle/tick/end 是 Phaser tween 設定(另支援 idle.randDelay)
//  holder(container) 包一個 Pic：cell 的隨機大小/翻轉/alpha 設在 Pic 上，tween 只動 holder，兩者才不會互相覆蓋
//  originY=1 時 Pic 底部對齊 holder 原點，holder 縮放會以底部為支點
//  parent=null 時 holder 直接放在 scene 上(x,y 為世界座標)，可以自己設 depth
//--------------------------------------------------

const rand = (v)=>Array.isArray(v) ? Phaser.Math.FloatBetween(v[0],v[1]) : v;

export default class FxCell
{
    constructor(scene, parent, img, anim={}, {x=0, y=0, size:defSize=32, originY=0.5}={})
    {
        this.scene = scene;
        this.anim = anim ?? {};
        this.idle = null;
        this.ticking = false;

        const {size=defSize, scale=1, alpha=1, flipX=false} = this.anim.cell ?? {};
        const pic = new Pic(scene, size, size, {icon:img});
        pic.setOrigin(0.5, originY).layout();
        const s = rand(scale);
        const flip = (flipX==='random' ? Math.random()<0.5 : flipX) ? -1 : 1;
        pic.setScale(s*flip, s).setAlpha(alpha);

        this.holder = scene.add.container(x, y, [pic]);
        parent?.add(this.holder);
        if(this.anim.spawn) {this.holder.setVisible(false);}
    }

    _tween(cfg, extra={})
    {
        return new Promise(resolve=>{
            this.scene.tweens.add({...cfg, ...extra, targets:this.holder, onComplete:resolve});
        });
    }

    startIdle()
    {
        this.holder.setVisible(true);
        const cfg = this.anim.idle;
        if(!cfg || this.idle) {return;}
        const {randDelay=0, ...tw} = cfg;
        this.idle = this.scene.tweens.add({...tw, targets:this.holder, delay:Math.random()*randDelay});
    }

    spawn(delay=0)
    {
        const cfg = this.anim.spawn;
        if(!cfg) {this.startIdle(); return Promise.resolve();}
        const {stagger, from, ...tw} = cfg;
        return this._tween(tw, {delay, onStart:()=>this.holder.setVisible(true)})
                    .then(()=>this.startIdle());
    }

    // idle 跟 tick 通常都動 scale，tick 期間先暫停 idle 避免互相搶值
    tick()
    {
        const cfg = this.anim.tick;
        if(!cfg || this.ticking) {return Promise.resolve();}
        this.ticking = true;
        this.idle?.pause();
        return this._tween(cfg).then(()=>{
            this.ticking = false;
            this.idle?.resume();
        });
    }

    // 先砍掉 spawn/idle/tick 所有進行中的 tween，end 才不會跟它們搶 scale/alpha
    end()
    {
        this.scene.tweens.killTweensOf(this.holder);
        this.idle = null;
        const cfg = this.anim.end;
        if(!cfg) {return Promise.resolve();}
        return this._tween(cfg);
    }

    destroy()
    {
        this.scene?.tweens.killTweensOf(this.holder);
        this.holder.destroy();
    }
}

// 區域多格的 spawn 先後(ZoneView 跟特效工具共用)：cells=[{gx,gy}]；center 由中心往外、random 隨機、near 由 dist(cell) 小的開始(沒給 dist 就當 center)
export function zoneDelays(cells, stagger=0, from='center', dist=null)
{
    if(from==='random') {return cells.map(()=>Math.random()*stagger*(cells.length-1));}
    if(from==='near' && dist)
    {
        const d = cells.map(dist);
        const order = [...d].sort((a,b)=>a-b);
        return d.map(x=>order.indexOf(x)*stagger);
    }
    return cells.map(c=>(Math.abs(c.gx)+Math.abs(c.gy))*stagger);
}

// 持續效果的特效格掛在角色 root 上(COM_Disp 跟特效工具共用)：cell.align='bottom'('top'|'center'|'bottom') 決定基準位置(view 的上緣/中間/下緣)，ox/oy 是額外偏移
export function attachCell(scene, root, cfg)
{
    const {align='bottom', ox=0, oy=0} = cfg.cell ?? {};
    const [top, bottom] = [root.view?.Min.y ?? 0, root.view?.Max.y ?? 0];
    const y = {top, center:(top+bottom)/2}[align] ?? bottom;
    return new FxCell(scene, root, cfg.img, cfg, {x:ox, y:y+oy, size:30, originY:1});
}

// body 是套在角色身體(view.shape)上的 tween；shape 原點是 view 中心，要以底部為支點轉就得同步補償 x/y；特效圖示(holder，掛在 root 上)也繞同一個支點跟著轉
// 補償只加差值不寫絕對值，被打時的擊退位移(COM_Anim._offset)、圖示的 spawn/tick 才不會被蓋掉
export function bodyTween(scene, view, holder, cfg)
{
    const shape = view.shape;
    const base = {x:shape.x, y:shape.y};
    const [px, py] = [base.x, base.y + view.max.y];
    const orbit = (obj, px, py, spin)=>{
        const d = {x:obj.x-px, y:obj.y-py};
        let off = {x:0, y:0, a:0};
        return (a)=>{
            const r = Phaser.Math.DegToRad(a);
            const [c, s] = [Math.cos(r), Math.sin(r)];
            const next = {x:d.x*c - d.y*s - d.x, y:d.x*s + d.y*c - d.y, a};
            obj.x += next.x - off.x;
            obj.y += next.y - off.y;
            if(spin) {obj.angle += next.a - off.a;}
            off = next;
        };
    };
    const body = orbit(shape, px, py, false);
    const icon = orbit(holder, view.x+px, view.y+py, true);
    const pivot = ()=>{body(shape.angle); icon(shape.angle);};
    const tween = scene.tweens.add({...cfg, targets:shape, onUpdate:pivot});
    return {tween, base};
}
