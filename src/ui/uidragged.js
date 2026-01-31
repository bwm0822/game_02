import {OverlapSizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js'
import Ui from './uicommon.js'
import {GM,UI} from '../core/setting.js'
import DB from '../data/db.js'
import {Slot} from './uiclass.js'
import * as ui from './uicomponents.js'
import UiCover  from './uicover.js'
import UiMain  from './uimain.js'


export default class UiDragged extends OverlapSizer
{
    static instance = null;
    constructor(scene, w, h)
    {
        super(scene, 0, 0, w, h);
        UiDragged.instance = this;
        Ui.addLayer(scene, UI.TAG.DRAGGED, this);    // 產生layer，並設定layer名稱

        this.addIcon(scene)
            .addCount(scene)
            .layout()
            .hide()
            .addListener()
    }


    static get on() {return this.instance.visible;}
    static get obj() {return this.instance;}
    static get owner() {return this.instance.owner;}
    static get dat() {return this.instance.dat;}

    static get isSlot() {return this.instance._obj?.content !== undefined;}
    static get isAbility() {return this.instance._obj?.id !== undefined;}


    get owner() {return this._obj.owner;}
    get content() {return this._obj.content;}
    set content(val) {this.setItm(val);}
    get dat() {return this._obj.dat;}
    get id() {return this._obj.id;}
    get i() {return this._obj.i;}
    get label() {return this.content.id.lab();}
    get gold() {return this.content.count*this.dat.gold;}


    addListener()
    {
        this//.setInteractive()
            .on('pointerup',()=>{
                console.log('-drop-')
                this.empty();
                this.disableInteractive();
            })
    }

    interact(on) 
    {
        if(on) {this.setInteractive();}
        else {this.disableInteractive();}
    }

    checkCat(cat) 
    {
        return (this.dat.cat & cat) === this.dat.cat;
    }

    update() 
    {
        if(this.content.count==0)
        {
            this.empty();
        }
        else
        {
            this.setCount(this.content.count>1 ? this.content.count : '')
        }
    }

    empty()
    {
        this.hide();
        delete this._obj;
        UiCover.close();
        UiMain.enable(true);
    }

    addIcon(scene)
    {
        this._sp=ui.uSprite.call(this, scene,{ext:{aspectRatio:true}});
        return this;
    }

    addCount(scene)
    {
        this._bbc=ui.uBbc.call(this, scene, {fontSize:20, 
                            color:'#fff', strokeThickness:5,
                            ext:{align:'right-bottom',expand:false}})
        return this
    }

    setItm(content)
    {
        if(content)
        {
            console.log(content)
            this._obj.content = content;
            this._obj.dat = DB.item(content.id);
            this.setIcon(this.dat.icon)
                .setCount(this.content.count>1 ? this.content.count : '')
        }
        else
        {
            this.empty();
        }
    }

    set(obj)
    {
        if(obj instanceof Slot)
        {            
            this._obj = {
                content: obj.content,
                dat: obj.dat,
                owner: obj.owner,
                gold: obj.gold
            };

            this.show()
                .setIcon(this.dat.icon)
                .setCount(this.content.count>1 ? this.content.count : '')
            UiCover.show();
            UiMain.enable(false);
        }
        else
        {
            console.log('ability', obj.id, obj.i)
            
            this._obj = {
                dat: DB.ability(obj.id),
                id: obj.id,
                i: obj.i,
            }

            this.show()
                .setIcon(this.dat.icon).setCount('')
            UiCover.show();
        }

    }

    setIcon(icon)
    {
        let [key,frame]=icon.split(':');
        const sp=this._sp;
        sp.setTexture(key,frame);
        sp.rexSizer.aspectRatio = sp.width/sp.height;
        this.layout();
        return this;
    }

    setCount(count)
    {
        this._bbc.setText(`[stroke=#000]${count}[/stroke]`);
        this.layout();
        return this;
    }

    drop()
    {
        console.log('-----trader=',this.owner.tradeType)
        if(this._obj && this.owner.tradeType!=GM.SELLER)
        {
            this.owner.drop(this._obj);
            this.empty();
        }
    }


    static set(obj) {return this.instance?.set(obj);}

    static setPos(x,y) {return this.instance?.setPosition(x,y);}

    static empty() {this.instance?.empty();}
    
    static checkCat(cat) {return this.instance?.checkCat(cat);}

    static update() {this.instance?.update();}

    static drop() {this.instance?.drop();}

    static interact(on) {this.instance.interact(on);}

}