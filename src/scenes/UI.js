import { Scene } from 'phaser';
import createUI,{UiBattle,UiMain,UiStore,UiDialog,Cursor} from '../ui.js';

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
    }

    uiEvent()
    {
        console.log('UI_event');
        const gameBattle = this.scene.get('GameBattle');
        gameBattle.events
            .on('cursor', (type)=>{Cursor.set(type);})
            .on('storage', (data)=>{UiStorage.show(data);})
            .on('trade', (data)=>{UiTrade.show(data);})
            .on('turn', (msg,resolve)=>{UiBattle.turn(msg,resolve);})
            .on('playerTurn', (msg,resolve)=>{UiBattle.playerTurn(msg,resolve);})
            .on('enemyTurn', (msg,resolve)=>{UiBattle.enemyTurn(msg,resolve);})
            .on('endPlayerTurn', ()=>{UiBattle.endPlayerTurn();})
            .on('end', (msg,resolve)=>{UiBattle.end(msg,resolve);})
            .on('exit', ()=>{UiBattle.exit();})
            .on('waitAck', (msg,resolve)=>{UiBattle.waitAck(resolve);})
            .on('ap', (ap)=>{UiBattle.setAp(ap);})
            .on('updateCard', ()=>{UiBattle.updateCard();})
            .on('setCard', (cards)=>{UiBattle.setCard(cards);})
            .on('useCard', ()=>{UiBattle.useCard();})
            .on('gameBattle',()=>{UiMain.hide();})

        const gameMap = this.scene.get('GameMap');
        gameMap.events
            .on('gameMap', ()=>{UiMain.show('map');})

        const gameTown = this.scene.get('GameTown');
        gameTown.events
            .on('gameTown', ()=>{UiMain.show('town');})
            .on('store', (slots)=>{UiStore.show(slots);})
            .on('dialog', (dialog)=>{UiDialog.show(dialog);})
            .on('cursor', (type)=>{Cursor.set(type);})
    }
}