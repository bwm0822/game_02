import {Scene} from 'phaser';
import createUI,{UiMain,UiCursor,UiDragged,UiCase,UiInv,UiTrade} from '../ui.js';
import * as Role from '../role.js';

export class UI extends Scene
{
    constructor ()
    {
        console.log('UI');
        super({key:'UI'});
    }

    create ()
    {
        createUI(this);
        this.uiEvent();
        this.processInput();
        this.input.setDefaultCursor('none');
    }

    processInput()
    {
        // this.input.on('pointermove',(pointer)=>{
        //     console.log('ui',pointer.x.toFixed(0),pointer.y.toFixed(0),',',pointer.worldX.toFixed(0),pointer.worldY.toFixed(0))
        //     Cursor.pos(pointer.x,pointer.y);
        // })

        // this.input.on('dragenter', ()=>{console.log('dragenter',this.id);})
        // .on('dragleave', ()=>{console.log('dragleave',this.id);})
        // .on('dragover', ()=>{console.log('dragover',this.id);})
        // .on('drop', ()=>{console.log('drop',this.id);})
        
        this.input.on('pointermove',(pointer)=>{
            if(UiDragged.on) {UiDragged.setPos(pointer.x,pointer.y);}
        })
    }

    uiEvent()
    {
        console.log('UI_event');
        // const gameBattle = this.scene.get('GameBattle');
        // gameBattle.events
        //     .on('cursor', (type)=>{Cursor.set(type);})
        //     .on('storage', (data)=>{UiStorage.show(data);})
        //     .on('trade', (data)=>{UiTrade.show(data);})
        //     .on('turn', (msg,resolve)=>{UiBattle.turn(msg,resolve);})
        //     .on('playerTurn', (msg,resolve)=>{UiBattle.playerTurn(msg,resolve);})
        //     .on('enemyTurn', (msg,resolve)=>{UiBattle.enemyTurn(msg,resolve);})
        //     .on('endPlayerTurn', ()=>{UiBattle.endPlayerTurn();})
        //     .on('end', (msg,resolve)=>{UiBattle.end(msg,resolve);})
        //     .on('exit', ()=>{UiBattle.exit();})
        //     .on('waitAck', (msg,resolve)=>{UiBattle.waitAck(resolve);})
        //     .on('ap', (ap)=>{UiBattle.setAp(ap);})
        //     .on('updateCard', ()=>{UiBattle.updateCard();})
        //     .on('setCard', (cards)=>{UiBattle.setCard(cards);})
        //     .on('useCard', ()=>{UiBattle.useCard();})
        //     .on('gameBattle',()=>{UiMain.hide();})

        const gameMap = this.scene.get('GameMap');
        gameMap.events
            .on('uiMain', ()=>{UiMain.show();})
            .on('cursor',(type)=>{UiCursor.set(type);})

        const gameTown = this.scene.get('GameTown');
        gameTown.events
            .on('uiMain', ()=>{UiMain.show();})
            .on('store', (slots)=>{UiStore.show(slots);})
            .on('dialog', (dialog)=>{UiDialog.show(dialog);})
            .on('cursor', (type)=>{UiCursor.set(type);})
            .on('case', (container,label)=>{UiCase.show(container,label);UiInv.show(Role.Player.data);})
            .on('trade', (owner)=>{UiTrade.show(owner);UiInv.show(Role.Player.data)})
    }
}