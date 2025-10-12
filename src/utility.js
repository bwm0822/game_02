import {GM} from './setting.js';

export default class Utility
{
    static _local={ weapon:'武器',armor:'防具',item:'道具',skill:'技能', 
                    helmet:'頭盔',chestplate:'胸甲',gloves:'手套',boots:'靴子',food:'食物',
                    necklace:'項鍊',ring:'戒子',bag:'背包',equip:'裝備',
                    other:'其他',storage:'儲量',endurance:'耐久',durability:'耐久',times:'次數',
                    attrs:'屬性',states:'狀態',
                    attack:'攻擊',
                    damage:'傷害',magazine:'彈匣',rof:'射速',range:'射程',
                    life:'生命',speed:'速度',attack:'攻擊',defense:'防禦',
                    hunger:'飢餓',thirst:'口渴',
                    shield:'護盾',defend:'防禦',heal:'回復',strong:'強壯',
                    poison:'下毒',weak:'虛弱',
                    use:'使用',drop:'丟棄',talk:'交談',trade:'交易',buy:'買',sell:'賣',split:'拆分',
                    open:'開啟',observe:'觀察',transfer:'移動',openbag:'開啟',inv:'背包',profile:'個人',
                    drink:'喝水',fill:'取水',cook:'烹煮',
                    dodge:'閃避',block:'擋格',
                    };
                    
    static wait_r()     {this._wid=0;}
    static wait_s()     
    {
        return;
        const stack = new Error().stack.split("\n"); 
        const callerLine = stack[2].trim(); // 取得呼叫 wait_s 的行資訊
        console.log(`%c[wait_s]${this._wid},${callerLine}`,'color:purple');
        return this._wid++;
    }
    static wait_e(id)   
    {
        return;
        const stack = new Error().stack.split("\n"); 
        const callerLine = stack[2].trim(); // 取得呼叫 wait_s 的行資訊
        console.log(`%c[wait_e]${id},${callerLine}`,'color:red');
    }

    static trace()
    {
        return;
        console.trace();
    }

    static local(key)
    {
        return Utility._local[key]??key;
    }

    static lut(key)
    {
        switch(key)
        {
            case GM.CAT_WEAPON: return 'weapon';
            case GM.CAT_HELMET: return 'helmet';
            case GM.CAT_CHESTPLATE: return 'chestplate';
            case GM.CAT_GLOVES: return 'gloves';
            case GM.CAT_BOOTS: return 'boots';
            case GM.CAT_NECKLACE: return 'necklace';
            case GM.CAT_RING: return 'ring';
            case GM.CAT_EQUIP: return 'equip';
            case GM.CAT_BAG: return 'bag';
            case GM.CAT_ITEM: return 'item';
            case GM.CAT_FOOD: return 'food';
            default: return key.toString();
        }
    }

    static shallowClone(obj)
    {
        if(Array.isArray(obj))
        {
            return [...obj]
        }

        return {...obj};
    }

    static deepClone(obj)
    {
        return JSON.parse(JSON.stringify(obj));
    }

    static dist(a, b)
    {
        return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
    }

    static clamp(value, min, max)
    {
        return Math.min(Math.max(value, min), max);
    }

    static addHighlight(scene, container)
    {
        let hls = [];
        let sps = container.getAll('type','Sprite');
        sps.forEach((sp) => {
            let w = sp.displayWidth+4;
            let h = sp.displayHeight+4;
            let hl = scene.add.sprite(sp.x,sp.y,sp.texture.key,sp.frame.name)
                                .setDisplaySize(w,h)
                                .setTintFill(0xffffff)
                                .setVisible(false);
            container.add(hl);
            container.moveTo(hl,0);
            hls.push(hl);
        });

        return hls;
    }

    static extractFileName(path)
    {
        return path.split('/').pop().split('.').slice(0, -1).join('.');
    }

    static isFull(container)
    {
        return container.capacity != -1 && container.items.length >= container.capacity;
    }

    static delay(ms)
    {
        return new Promise((resolve, reject) => {
            //scene.time.delayedCall(ms, resolve);
            setTimeout(resolve, ms);
        });
    }

    static clear()
    {
        localStorage.clear();
    }

    static remove(key='record')
    {
        localStorage.removeItem(key);
    }

    static save(data,key='record')
    {
        localStorage.setItem(key,JSON.stringify(data));
    }

    static delete(key='record')
    {
        localStorage.removeItem(key);
    }

    static load(key='record')
    {
        return JSON.parse(localStorage.getItem(key));
    }

    static isArray(target) {return Array.isArray(target);}
    static isObject(target) 
    {
        return (typeof target === 'object' && !Array.isArray(target) && target !== null); 
    }

    static isEmpty(slot)
    {
        return !slot || Object.keys(slot).length==0;
    }

    static roll(min=0,max=99)
    {
        return Phaser.Math.Between(min,max);
    }

    // static random(s,e)
    // {
    //     let d = Math.round(Math.random(0,1)*(e-s));
    //     return s+d;
    // }

    static str2Func(str)
    {
        try 
        {
            // 使用 eval 將字串轉換成函數
            const func = eval(str); //const func = eval(`(${str})`);
            if (typeof func === 'function') {return func;} 
            else {throw new Error('字串未轉換成函數');}
        } 
        catch (error) 
        {
            console.warn('轉換失敗:', error);
            //console.error('轉換失敗:', error);
            return null;
        }
    }

    static str2Func2(str)
    {
        try 
        {
            const func = new Function(str);
            if (typeof func === 'function') {return func;} 
            else {throw new Error('Provided string is not a function');}
        } 
        catch (error) 
        {
            console.error('Error executing function from string:', error);
            return null;
        }
    }

    static tick2Str(ticks)
    {
        let d = Math.floor(ticks / 1440);
        let h = Math.floor((ticks % 1440) / 60);
        let m = ticks % 60;
        let str = `${m}m`;
        if(h>0) {str = `${h}h${str}`;}
        if(d>0) {str = `${d}d${str}`;}
        return str;
    }

    static isString(value) 
    {
        return typeof value === 'string' || value instanceof String;
    }

    static format(str, ...args) 
    {
        return str.replace(
            /{(\d+)}/g,              // 找出 {0}、{1}... 的位置
            (match, index) =>        // match 是整個匹配到的字串，index 是捕獲的數字
            typeof args[index] !== 'undefined' ? args[index] : match
        );
    }

    static fmt_Eff(str, obj, self, target) 
    {
        return str.replace(/{#(\w+)}/g, (match, key) => {
                let val = obj[key]
                if(val) 
                {
                    switch(key)
                    {
                        case 'tag': return `[color=deepskyblue]${val.lab()}[/color]`;
                        case 'dur': return `[color=white]${val}[/color]`;
                        // case 'mul': return `[color=${val>1?'lime':'red'}]${val*100}[size=18]%[/size][/color]`;
                        case 'self': return self;
                        case 'target': return target;
                        default:
                            // let n = Number(val);
                            // let c = isNaN(n) ? 'white' : (n > 0 ? 'lime' : 'red');
                            // return `[color=${c}]${isNaN(n)?val.lab():n}[/color]`;
                            return this.fmt_Stat(key,val);
                    }
                }
                return '';
            }
        );
    }

    static getStorageCount(storage)
    {
        // 傳回 storage 被佔據的數量
        return storage?.items.filter(item => item).length??0;
    }

    static fmt_mod(mod)
    {
        let sign = function(val) {return val>0?'+':'';}
        if(mod.a !== undefined) {return sign(mod.a)+`${mod.a}`;}
        if(mod.m !== undefined) {return sign(mod.m)+`${mod.m*100}%`;}
    }

    static fmt_Stat(key, val, elm)
    {
        let cat = elm?.dat?.cat;
        switch(key)
        {
            case GM.ENDURANCE: return this.tick2Str(elm.itm[key]);
            case GM.STORAGE: return `${this.getStorageCount(elm.itm[key])}[size=18]/${val}[/size]`;
            case GM.CAPACITY:
            case GM.TIMES: return `${elm.itm[key]}[size=18]/${val.max}[/size]`;
            default:
                if(typeof val === 'number')
                {
                    GM.PCT.includes(key) && (val=val*100+'[size=18]%[/size]');
                    return `[color=white]${val}[/color]`;
                }
                else
                {
                    let f = parseFloat(val);
                    if(f)
                    {
                        let c = f > 0 ? 'orange' : 'lime';
                        let s = f > 0 ? '+' :'';
                        
                        if(val.includes('*'))
                        {
                            f=f*100+'[size=18]%[/size]';
                            return `[color=${c}][size=18]1${s}[/size]${f}[/color]`;
                        }
                        else
                        {
                            GM.PCT.includes(key) && (f=f*100+'[size=18]%[/size]');
                            return `[color=${c}]${s}${f}[/color]`;
                        }
                    }
                    else
                    {
                        return `[color=white]${val.lab()}[/color]`;
                    }
                }
        }

    }


    static toStorage(capacity,items)
    {
        if(capacity == undefined) {capacity = -1;}
        if(!items) {items = [];}
        let bag={capacity:capacity,items:[]};
        items.forEach((item,i)=>{bag.items[i] = typeof item === 'object' ? item : {id:item,count:1};})
        return bag;
    }

    static rotate(x, y, rad) 
    {
        // const rad = theta * Math.PI / 180; // 轉成弧度
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const xNew = x * cos - y * sin;
        const yNew = x * sin + y * cos;
        return [xNew, yNew];
    }

    static drawPolygon(graphics, points)
    {
        const polygon = new Phaser.Geom.Polygon(points);
        graphics.clear();
        graphics.fillStyle(0xffffff, 0.5);
        graphics.fillPoints(polygon.points, true);
        graphics.lineStyle(2, 0xffffff);
        graphics.strokePoints(polygon.points, true);
    }

    static drawBlock(graphics, rect)
    {
        let [x,y,width,height] = [rect.x, rect.y, rect.width, rect.height];
        let [l,r,t,b] = [rect.l, rect.r, rect.t, rect.b];
        // graphics.clear();
        graphics.fillStyle(0xffffff, 0.5);
        graphics.fillRect(x, y, width, height);
        graphics.lineStyle(2, 0xffffff);
        if(l) {graphics.lineBetween(x, y, x, y+height);}
        if(r) {graphics.lineBetween(x+width, y, x+width, y+height);}
        if(t) {graphics.lineBetween(x, y, x+width, y);}
        if(b) {graphics.lineBetween(x, y+height, x+width, y+height);}
    }

    static parseDes(des, stats, self, target)
    {
        // 範例:
        // 將       造成{#mul*100}%的{#elm}傷害
        // 轉成     `造成${stats.mul*100}%的${stats.elm}傷害`
        // 並執行   eval(`造成${stats.mul*100}%的${stats.elm}傷害`)

        // 取得變數 stats 的名稱(字串)
        let wrapper = {stats}
        let vName = Object.keys(wrapper)[0]
        // console.log('-----vName:',vName)
        // 將 '{' 取代為 '${' , '#' 取代為 'vName.'
        des = des.replace(/{/g,'${').replace(/#/g, vName+'.')
        // 將字串前後加入 '`'，並執行
        des = '`' + des + '`';
        // console.log('-----stats:',stats)
        // console.log('-----des:',des)
        
        return eval(des);   
    }


    // // 使用範例
    // static raycast(startX, startY, endX, endY, group) 
    // {
    //     const ray = new Phaser.Geom.Line(startX, startY, endX, endY);
    //     const hits = [];

    //     group.getChildren().forEach(obj => {
    //         if (!obj.body) return;

    //         const bounds = new Phaser.Geom.Rectangle(
    //             obj.body.x,
    //             obj.body.y,
    //             obj.body.width,
    //             obj.body.height
    //         );

    //         if (Phaser.Geom.Intersects.LineToRectangle(ray, bounds)) {
    //             hits.push(obj);
    //         }
    //     });

    //     return hits;
    // }

    static raycast(startX, startY, endX, endY, groups) 
    {
        const ray = new Phaser.Geom.Line(startX, startY, endX, endY);
        const hits = [];

        groups.forEach(group => {
            group.getChildren().forEach(obj => {
                if (!obj.body) return;

                const bounds = new Phaser.Geom.Rectangle(
                    obj.body.x,
                    obj.body.y,
                    obj.body.width,
                    obj.body.height
                );

                if (Phaser.Geom.Intersects.LineToRectangle(ray, bounds)) {
                    hits.push(obj);
                }
            });
        });

        return hits;
    }

}







// String.prototype.local = function(){ return Utility.local(this); };
// Number.prototype.local = function(){ return Utility.local(Utility.lut(this)); };





