import {GameObject} from '../core/gameobject.js'
import TimeManager from '../time.js'


export class Role extends GameObject
{
    constructor(scene,x,y)
    {
        super(scene,x,y);
        this.isAlive = true;
    }

    get id() {return this.bb.id;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------

    _addToList() {this.scene.roles && this.scene.roles.push(this);}
    
    _removeFromList()
    {
        if(!this.scene.roles) {return;}
        const index = this.scene.roles.indexOf(this);
        if(index>-1) {this.scene.roles.splice(index,1);}
    }

    _registerTimeManager()
    {
        this._updateTimeCallback = this._updateTime.bind(this); // 保存回调函数引用
        TimeManager.register(this._updateTimeCallback);
    }
        
    _unregisterTimeManager() {TimeManager.unregister(this._updateTimeCallback);}

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------

}
