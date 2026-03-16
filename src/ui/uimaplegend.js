import UiFrame from './uiframe.js'
import {GM,UI} from '../core/setting.js'
import {uPanel,uButton} from './uicomponents.js'


export default class UiMapLegend extends UiFrame
{
    static instance=null;
    constructor(scene)
    {
        const config=
        {
            x: GM.w,
            y: 0,
            orientation:'x',
            width:100,
            height:100,
            space: {left:20,bottom:20},
        }
        super(scene, config, UI.TAG.MAPLEGEND);
        UiMapLegend.instance = this;
        this.addBg(scene,{})
            .create()
            .setOrigin(1,0)
            .layout()
            .hide()
        
    }

    shift()
    {
        this.x+=this.x>GM.w?-this._p.width:this._p.width;
        this._btn.setTcon(this.x>GM.w?' ◀':' ▶')
    }

    create()
    {
        const scene=this.scene;

        this._btn=uButton.call(this,scene,{bg:{color:GM.COLOR.BLACK,alpha:0.5,radius:{tl:10,bl:10}},
                                            tcon:' ▶',
                                            cBG:GM.COLOR.BLACK,aBG:0.5,
                                            onclick:()=>{this.shift();},
                                            // ext:{align:'top'},
                                            ext:{expand:true}
                                        });

        const p=uPanel.call(this,scene,{bg:{color:GM.COLOR.BLACK,alpha:0.5},
                                        orientation:'y',
                                        space:{top:10,bottom:10,right:10}});
        this._p=p;

        uButton.call(p,scene,{style:UI.BTN.OPTION,text:'玩家',ext:{expand:true},
                                onclick:()=>{this.send('focusOnPlayer')}});
        this._ndName = uButton.call(p,scene,{style:UI.BTN.CHECK,text:'🏷️顯示地名',ext:{expand:true},
                                onclick:(btn)=>{this.send('showNodeName',btn.value)}})
        this._ndTag = uButton.call(p,scene,{style:UI.BTN.CHECK,text:'📜顯示任務',ext:{expand:true},
                                onclick:(btn)=>{this.send('showNodeTag',btn.value)}})

        return this;
    }

    colse()
    {
        super.close();
        this.unregister();   
    }

    reset()
    {
        if(this.x>GM.w)
        {
            this.x+=-this._p.width;
            this._btn.setTcon(' ▶');
        }
        this._ndName.setValue(true);
        this._ndTag.setValue(true);
    }

    show()
    {
        super.show();
        this.reset();
        this.register(GM.UI_RIGHT);
    }


}