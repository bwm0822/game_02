import * as Role from './role';
import Utility from './utility';
import {CardDB} from './database'
import Record from './record';

export default class Battle
{
    static instance = null;
    constructor()
    {
        Battle.instance = this;
        this._action;
    }

    init(scene)
    {
        console.log('[init]');
        this.scene = scene;
        this.createPlayer(scene);
        this.createEnemys(scene);
        this._turns = 0;
        this.loop();
    }

    createPlayer(scene)
    {
        this._player = Role.Player.avatar(scene,200,300);
    }

    createEnemys(scene)
    {
        let loc = [{x:500,y:300}, {x:700,y:300}, {x:900,y:300}]
        let enemys = scene._node.enemys;
        this._enemys=[];
        enemys.forEach((enemy)=>{
            let x=loc[enemy.loc].x;
            let y=loc[enemy.loc].y;
            this._enemys.push(new Role.Npc(scene,enemy.id,
                                {x:x, y:y, faceTo:'left', parent:this._enemys}))
        })

    }

    async loop()
    {
        console.log('%c[loop]start','color:red');

        Utility.wait_r();
        while(true)
        {
            await this.emit_wait('turn',++this._turns);
            await this.prepare();
            if(await this.playerTurn()) {break;}
            if(await this.enemyTurn()) {break;}
            await this.next();
        }
        this.emit('exit');  // => ui.js / UiBattle.exit()

        console.log('%c[loop]end','color:red');
    }

    emit_wait(type,event)
    {
        return new Promise((resolve)=>{
            this.scene.events.emit(type, event, resolve);
        });
    }

    emit(type,msg)
    {
        this.scene.events.emit(type, msg);
    }

    setSelected(sel) {this._sel = sel;}
    getSelected() {return this._sel;}
    clearSelected() {this._sel = undefined;}

    interact(type, target)
    {
        switch(type)
        {
            case 'over': this.over(target);break;
            case 'out': this.out(target);break;
            case 'up': this.up(target);break;
        }
    }

    over(target)
    {
        //console.log('over:', target);
    }

    out(target)
    {
        //console.log('out:', target);
    }

    async up(target)
    {
        let sel = this.getSelected();
        //console.log('up:',sel,this._player.ap);

        if(!sel) {return;}
        if(this._player.ap>=sel.ap)
        {
            this._player.ap-=sel.ap;
            this.emit('useCard');
            await this._player.action(CardDB.get(sel.id), target);
            this.clearSelected();
            if(this.isAllEnemyDead()){this.emit('endPlayerTurn');}
        }
    }

    getCards()
    {
        return ['attack','shield','cure','poison','strong','weak'];
    }

    async prepare()
    {
        console.log('%c[0]prepare','color:blue');
        for(let i=0;i<this._enemys.length;i++)
        {
            let enemy = this._enemys[i];
            await enemy.prepare();
            //await Utility.delay(250);
        }
    }

    async playerTurn()
    {
        console.log('%c[1]playerTurn','color:blue');

        await this.emit_wait('playerTurn', {n:this._turns,ap:this._player.ap}); // ui.js/UiBattle.playerTurn()
        
        // [1] turn start
        await this._player.turnStart();
        if(this._player.dead){await this.end(false); return true;}
        this.emit('setCard',this.getCards());
        
        // [2]
        await this.emit_wait('waitAck');    // ui.js/UiBattle.waitAck()
        if(this.isAllEnemyDead()){await this.end(true); return true;}
        
        // [3] turn end
        await this._player.turnEnd();
        if(this._player.dead){await this.end(false); return true;}

        return false;
    }

    async enemyTurn()
    {
        console.log('%c[2]enemyTurn','color:blue');

        await this.emit_wait('enemyTurn', this._turns); // ui.js/UiBattle.enemyTurn()
        
        // [1] turn start
        //await Promise.all(this._enemys.map((enemy) => enemy.turnStart()));
        //for(let i=0; i<this._enemys.length; i++){await this._enemys[i].turnStart();}
        //await Utility.delay(1000);

        // [2]
        console.log("len",this._enemys.length);
        for(let i=0;i<this._enemys.length;i++)
        {
            let enemy = this._enemys[i];
            await enemy.turnStart();
            await enemy.execute(this._player);
            await Utility.delay(500);
            if(this._player.dead) {await this.end(false); return true;}
            await enemy.turnEnd();
        }
        await Utility.delay(500);
        
        // [3] turn end
        // await Promise.all(this._enemys.map((enemy) => enemy.turnEnd()));
        // if(this.isAllEnemyDead()){await this.end(true); return true;}
        //for(let i=0; i<this._enemys.length; i++){await this._enemys[i].turnEnd();}
        if(this.isAllEnemyDead()){await this.end(true); return true;}

        //await Utility.delay(500);
        return false;
    }

    async next()
    {
        console.log('%c[3]next','color:blue');
        let tbds = this._enemys.filter(enemy=>enemy.dead);
        tbds.forEach((tbd)=>{this._enemys.splice(this._enemys.indexOf(tbd),1);});

        await this._player.turnNext();
        await Promise.all(this._enemys.map((enemy) => enemy.turnNext()));
        //this._enemys.forEach((enemy)=>{enemy.turnNext();})
    }

    isAllEnemyDead()
    {
        return this._enemys.filter((enemy)=>{return !enemy.dead;}).length == 0;
    }

    async end(result)
    {
        console.log('[gameOver]');
        await this.emit_wait('end', result);    // ui.js/UiBattle.end()
        console.log('len',this._enemys.length);
        await Promise.all(this._enemys.map((enemy) => {enemy.destroy()}));
        //this._enemys.forEach((enemy)=>{console.log('destroy');enemy.destroy(); });
        //for(let i=0;i<this._enemys.length;i++){this._enemys[i].destroy();i--;}
        this._player.gameOver();
        if(result)
        {
            console.log('save',this.scene._node.id);
            Record.data.node=this.scene._node.id;
            Record.data.role=this._player.role.record();
            Record.save();
        }
    }
  
    static init(scene)
    {
        if(!this.instance){Battle.instance = new Battle(scene);}
        Battle.instance.init(scene);
    }

    static setSelected(sel)
    {
        Battle.instance.setSelected(sel);
    }

    static interact(type, target)
    {
        Battle.instance.interact(type, target);
    }
}