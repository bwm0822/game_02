import {GameObject} from '../core/gameobject.js'
import TimeSystem from '../systems/timesystem.js'
import {GM} from '../setting.js'
import Record from '../record.js'


export default class Role extends GameObject
{
    get id() {return this.bb.id;}
    get icon() {return this.bb.meta.icon;}
    get job() {return this.bb.meta.job;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _saveData(value)
    {
        if(this.uid===-1)
        {
            if(!Record.game.roles) {Record.game.roles={};}
            Record.game.roles[this.id]=value;
        }
        else
        {
            super._saveData(value);
        }
    }

    _loadData()
    {
        if(this.uid===-1) {return Record.game.roles?.[this.id];}
        else {return super._loadData();}
    }

    _addToList() {this.scene.roles && this.scene.roles.push(this);}
    
    _removeFromList()
    {
        if(!this.scene.roles) {return;}
        const index = this.scene.roles.indexOf(this);
        if(index>-1) {this.scene.roles.splice(index,1);}
    }

    _registerTimeSystem()
    {
        this._updateTimeCallback = this._updateTime.bind(this); // 保存回调函数引用
        TimeSystem.register(this._updateTimeCallback);
    }
        
    _unregisterTimeSystem() {TimeSystem.unregister(this._updateTimeCallback);}


    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    use(ent)
    {
        // console.log(ent.content, ent.dat)
        const{root}=this.ctx;

        const list=[GM.TIMES, GM.CAPACITY];
        let key = Object.keys(ent.dat).find(key=>list.includes(key));

        if(!key || ent.content[key]>0)
        {
            ent.dat.effects.forEach(eff=>{
                switch(eff.stat)
                {
                    case GM.HP: root.heal?.(eff); break;
                }
            })

            if(key) 
            {
                if(--ent.content[key]===0 && !ent.dat[GM.KEEP])
                {
                    ent.content.count--;
                }
            }
            else
            {
                ent.content.count--;
            }
        }

        if(ent.content.count<=0) {ent.empty();}
    }
}
