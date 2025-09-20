import {GM} from '../setting.js';
import {ItemView} from './view.js';
import {Inv} from './inventory.js';
import {GameObject} from './gameobject.js';

export class Box extends GameObject
{
    get acts() {return ['open']}
    get act() {return this.acts[0];}

    init_prefab()
    {        
        this.add(new ItemView(this,true))
            .add(new Inv(this))

        //
        this.on('open', this.open.bind(this))

        this.load();

        this._addToList();

        console.log('uid:',this.uid,'qid:',this.qid)
    }

    open()
    {
        this._send('storage', this); 
    }





    
}