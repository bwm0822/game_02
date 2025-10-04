import {GM} from '../setting.js';
import {ItemView} from '../components/view.js';
import {Storage} from '../components/inventory.js';
import {GameObject} from '../core/gameobject.js';

export class Box extends GameObject
{
    get acts() {return ['open']}
    get act() {return this.acts[0];}

    init_prefab()
    {      
        // 加入元件  
        this.add(new ItemView(this.scene),{modify:true})
            .add(new Storage())

        //
        this.on('open', this.open.bind(this))

        this.load();

        this._addToList();

        // console.log('uid:',this.uid,'qid:',this.qid)
    }

    open()
    {
        this._send('storage', this); 
    }





    
}