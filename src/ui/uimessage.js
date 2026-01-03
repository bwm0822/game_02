import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import Utility from '../core/utility.js'

export default class UiMessage extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x: 10,
            y: GM.h-100,
            // width: 200,
            // height: 200,
            orientation:'y',
            // rtl:true
        }

        super(scene, config , UI.TAG.MESSAGE)
        UiMessage.instance=this;

        this.queue = [];

        this//.addBg(scene,{color:GM.COLOR.WHITE,alpha:0.25})
            // .addTop(scene)
            // .addSpace()     // 加入space
            .setOrigin(0,1)
            .layout()
            .hide()
        
        // this.unit_test(scene)
    }


    async unit_test(scene)
    {

        this.push('1.test')
        await Utility.delay(500)
        this.push('2.test')
        // await Utility.delay(500)
        this.push('3.test')
        // await Utility.delay(500)
        this.push('4.test')
        // await Utility.delay(500)
        this.push('5.test')
        // await Utility.delay(500)
        this.push('6.test')
        this.push('7.test')
        this.push('8.test')

        await Utility.delay(3000)

        this.close();

    }

    process(next=false,{msgCnt=5,delay=500}={})
    {
        if (next) {this.queue.shift();}
        else if(this.queue.length>1){return;}   // 忙碌中
        if (this.queue.length===0) {return;}    // queue 為空

        const children = this.getChildren();

        if(children.length === msgCnt)   // 超過msg上限，移除第一個msg
        {
            this.remove(children[0],true);
            this.layout();
        }

        // 新增 msg
        this.addMsg(this.queue.at(0));

        // 
        setTimeout(()=>{this.process(true);}, delay);
    }

    addMsg(msg, {wrapWidth=300,duration=2000}={})
    {
        const bbc = ui.uBbc.call(this,this.scene,{text:msg,wrapWidth:wrapWidth,ext:{align:'left'}});
        this.layout();
        bbc.tween=this.scene.tweens.addCounter({
            duration: duration,
            onComplete: () => {bbc.setColor(GM.COLOR.LIGHTGRAY)}
        })
        
        return this;
    }

    push(msg) 
    {
        if(!this.visible) {this.show();}
        this.queue.push(msg);
        this.process();
        return this;
    }

    clean()
    {
        this.queue = [];
        // 強制關閉 tween，以避免移除物件後，還繼續執行 tween 而導致錯誤
        this.getChildren().forEach((child)=>{child.tween.stop()})
        // 清除 children
        this.removeAll(true).layout();
    }

    close()
    {
        super.close();
        this.unregister();
    }

    show()
    {
        super.show();
        this.register(this,GM.UI_MSG);
    }

    static clean() {this.instance?.clean();}
    static push(msg) {return this.instance?.push(msg);}
}