
export class Store extends Phaser.GameObjects.Container
{
    constructor(scene)
    {
        console.log('store');
        super(scene);
        this.scene=scene;
        this.items="";
        this.addListener(scene);
        //this.UnitTest();

    }

    // set displayWidth(value) {this._w = value;}
    // set displayHeight(value) {this._h = value;}

    setTexture(key,frame)   // map.createFromObjects 會呼叫到
    {
        //console.log(key,frame);
        let sp = this.scene.add.sprite(0,0,key,frame);
        this.add(sp);
        this.setSize(sp.width,sp.height);
        this._sp = sp;
    }

    setFlip() {} // map.createFromObjects 會呼叫到

    UnitTest()
    {
        this._slots=[
            {label:'gun',icon:'weapons/0',price:100,descript:'武器'},
            {label:'gun',icon:'weapons/1',price:100,descript:'武器'},
            {label:'gun',icon:'weapons/2',price:100,descript:'武器'},
            {label:'gun',icon:'weapons/3',price:100,descript:'武器'},
        ]
    }

    addListener(scene)
    {
        let outline = scene.plugins.get('rexOutlinePipeline');
        this.on('pointerup',()=>{this.scene.events.emit('store',this.items);})
            .on('pointerover', () => { outline.add(this,{thickness:3,outlineColor:0xffffff})})
            .on('pointerout', () => { outline.remove(this);})
    }

    init()
    {
        console.log('init...')
        this.items = JSON.parse(this.items);
        //this.setSize(this._w,this._h);
        this.setInteractive()
    }
}