import {GM} from './setting.js';

export default class Utility
{
    static _local={ weapon:'武器',armor:'防具',item:'道具',skill:'技能', 
                    helmet:'頭盔',chestplate:'胸甲',gloves:'手套',boots:'靴子',
                    necklace:'項鍊',ring:'戒子',
                    other:'其他',
                    attrs:'屬性',states:'狀態',
                    attack:'攻擊',
                    damage:'傷害',magazine:'彈匣',rof:'射速',range:'射程',
                    life:'生命',speed:'速度',attack:'攻擊',defense:'防禦',
                    shield:'護盾',defend:'防禦',heal:'回復',strong:'強壯',
                    poison:'下毒',weak:'虛弱',
                    use:'使用',drop:'丟棄',talk:'交談',trade:'交易',buy:'買',sell:'賣',
                    open:'開啟',observe:'觀察',transfer:'移動',
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
            case GM.CAT_ITEM: return 'item';
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
}

String.prototype.local = function(){ return Utility.local(this); };
Number.prototype.local = function(){ return Utility.local(Utility.lut(this)); };





