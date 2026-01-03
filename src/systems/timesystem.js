import Record from '../infra/record.js'

const ticksMax = 24*60-1;
export default class TimeSystem
{
    static time = {d:0,h:0,m:0};
    static ticks = 0;

    static list = [];

    static async inc(minutes = 1) 
    {
        this.time.m += minutes;

        if (this.time.m >= 60) {
            this.time.h += Math.floor(this.time.m / 60);
            this.time.m = this.time.m % 60;
        }

        if (this.time.h >= 24) {
            this.time.d += Math.floor(this.time.h / 24);
            this.time.h = this.time.h % 24;
        }

        this.ticks = this.time2Ticks(this.time);

        console.log('[time] inc')
        // this.emit(minutes);
        await this.aEmit(minutes);
    }

    static async aEmit(dt)
    {
        let promises=[];
        this.list.forEach( (cb)=>{promises.push(cb(dt,this.time))} )

        await Promise.all(promises);
    }

    static update()
    {
        this.emit(0);
    }

    static set(type,val)
    {
        if(type in this.time)
        {
            this.time[type] = parseInt(val, 10);
            console.log(this.time);
        }
    }

    static register(cb)
    {
        this.list.push(cb)
    }

    static unregister(cb)
    {
        let index = this.list.indexOf(cb);
        if(index>-1) {this.list.splice(index,1);}
    }

    static emit(dt)
    {
        this.list.forEach((cb)=>{cb(dt,this.time);})
    }

    static start()
    {
        console.log('[time] start')
        this.emit(0, this.time);
    }

    static load()
    {
        if(Record.game.time) 
        {
            this.time = Record.game.time;
            this.ticks = this.time2Ticks(this.time);
        }
        this.list = [];
    }

    static save()
    {
        Record.game.time = this.time;
    }

    static checkRange(day, time, range)
    {
        // console.log(day, time, range);
        if(day != this.time.d) {return false;}
        let tt = this.time2Ticks(time);
        let r = range.split('~');
        let ts = this.str2Ticks(r[0]);
        let te = this.str2Ticks(r[1]);
        if(te<=ts) 
        {
            return (tt>=ts && tt<=ticksMax) || (tt>=0 && tt<te);
        }
        else 
        {
            return tt>=ts && tt<te;
        }
    }

    static inRange(range)
    {
        let r = range.split('~');
        let ts = this.str2Ticks(r[0]);
        let te = this.str2Ticks(r[1]);
        if(te<=ts) 
        {
            return (this.ticks>=ts && this.ticks<=ticksMax) ||
                    (this.ticks>=0 && this.ticks<te);
        }
        else 
        {
            return this.ticks>=ts && this.ticks<te;
        }
        
    }

    static atTime(t)
    {
        t = t.split('~');
        let ts = this.str2Ticks(t[0]);
        // let te = this.str2Ticks(t[1]);
        return this.ticks==ts;
        
    }

    // static time2Ticks(time)
    // {
    //     return time.h * 60 + time.m;
    // }

    static str2Ticks(str) 
    {
        let sps = str.split(':');
        let hours = parseInt(sps[0], 10);
        let minutes = parseInt(sps[1], 10);
        return hours * 60 + minutes;
    }

    static time2Ticks(time)
    {
        if(typeof time == 'string') {return this.str2Ticks(time);}
        else {return time.h * 60 + time.m;}
    }
}
