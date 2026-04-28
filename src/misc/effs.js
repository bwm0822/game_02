import {Pic} from '../ui/uicomponents.js'

//--------------------------------------------------
// 類別 : 特效元件 
// 功能 : 投射物特效，如 : 箭、火球
//--------------------------------------------------
export class Projectile extends Pic
{
    constructor(scene, x, y, {img, size=25, deg=-90}={})
    {
        super(scene, size, size, {icon:img,x:x,y,y:y});
        scene.add.existing(this);
        this.setDepth(Infinity);
        this.from = {x:x, y:y};
        this.deg = deg;
    }

    shoot(x, y, {onComplete, bias=50, speed=350}={})
    {
        let from = this.from;
        
        let dx = x - from.x;
        let dy = y - from.y;
        let dist = Phaser.Math.Distance.Between(0, 0, dx, dy);
        let rad = dy > 0 ? Math.acos(dx/dist) : -Math.acos(dx/dist);
        bias = -bias * Math.cos(rad);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        this.scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: dist/speed*1000, 
            onUpdate: (tween, target, key, current, previous, param)=>{
                const x = dist * current;
                const y = bias * Math.sin(current * Math.PI);

                // rotate + offset
                const nx = x * cos - y * sin + from.x; 
                const ny = x * sin + y * cos + from.y;
                // angle                
                // let a = Math.atan((ny - this.y)/(nx - this.x));
                const a = Math.atan2(ny - this.y, nx - this.x);

                this.x = nx;
                this.y = ny;
                this.angle = (a * 180 / Math.PI) + this.deg;
            },
            onComplete:()=>{onComplete?.();this.destroy();}
        });
    }
}

// export class Projectile extends Phaser.GameObjects.Sprite
// {
//     constructor(scene, x, y, {img, scl=1, deg=0}={})
//     {
//         let[texture, frame] = img.split(':')
//         super(scene, x, y, texture, frame);
//         scene.add.existing(this);
//         this.setScale(scl);
//         this.depth = Infinity;
//         this.from = {x:x, y:y};
//         this.deg = deg;
//     }

//     shoot(x, y, {onComplete, bias=50, speed=350}={})
//     {
//         let from = this.from;
        
//         let dx = x - from.x;
//         let dy = y - from.y;
//         let dist = Phaser.Math.Distance.Between(0, 0, dx, dy);
//         let rad = dy > 0 ? Math.acos(dx/dist) : -Math.acos(dx/dist);
//         bias = -bias * Math.cos(rad);
//         const cos = Math.cos(rad);
//         const sin = Math.sin(rad);

//         this.scene.tweens.addCounter({
//             from: 0,
//             to: 1,
//             duration: dist/speed*1000, 
//             onUpdate: (tween, target, key, current, previous, param)=>{
//                 let x = dist * current;
//                 let y = bias * Math.sin(current * Math.PI);

//                 // rotate + offset
//                 let nx = x * cos - y * sin + from.x; 
//                 let ny = x * sin + y * cos + from.y;
//                 // angle                
//                 // let a = Math.atan((ny - this.y)/(nx - this.x));
//                 let a = Math.atan2(ny - this.y, nx - this.x);

//                 this.x = nx;
//                 this.y = ny;
//                 this.angle = (a * 180 / Math.PI) + this.deg;
//             },
//             onComplete:()=>{onComplete?.();this.destroy();}
//         });
//     }
// }