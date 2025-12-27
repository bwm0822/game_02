import UiFrame from "./uiframe"
import * as ui from './uicomponents.js'
import {GM,UI} from '../setting.js'
import {Pic} from '../uibase.js'

export default class UiDialog extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h,
            width : 600,
            height : 300,
            orientation : 'y',
            // space: 10,
            space:UI.SPACE.FRAME,
            cover: {touchClose:false,alpha:0.5},
        }

        super(scene, config, UI.TAG.DIALOG)
        UiDialog.instance = this;

        this.addBg(scene)
            // .addTop(scene, 'unit test')
            .addSpeakerA(scene)
            .addSpeakerB(scene)
            .setOrigin(0.5,1)
            .layout()
            .hide()

        // this.unit_test()

    }

    unit_test()
    {
        this._spkA.setName('Karen')
                    .setText('Test')
                    .next()

        this._spkB.setText(['交談','交易','離開'])

        this.layout()
    }

    addSpeakerA(scene)
    {
        const p = ui.uPanel.call(this,scene,
                                    {bg:{color:GM.COLOR.LIGHT},
                                    space:UI.SPACE.LRTBI_10,
                                    ext:{expand:true,proportion:1}})

        const uIcon = new Pic(scene,GM.PORTRAITS.W,GM.PORTRAITS.H,{icon:'portraits/0'})
        p.add(uIcon,{align:'top'})

        const pR= ui.uPanel.call(p,scene,{bg:UI.BG.BORDER,
                                            orientation:'y',
                                            ext:{expand:true,proportion:1}});
        const uName = ui.uBbc.call(pR,scene,{text:`[color=yellow]阿凡達[/color]`,
                                                ext:{align:'left'}})
        const uText = ui.uBbc.call(pR,scene,{text:'內容',wrapWidth:500,
                                                ext:{align:'left'}})

        // page
        const lineCnt=3;
        const uPage = scene.plugins.get('rexTextPage').add(uText,{maxLines:lineCnt});

        // 操作介面
        p.setIcon = (icon)=>{uIcon.setIcon(icon); return p;}
        p.setName = (name)=>{uName.setText(`[color=yellow]${name}[/color]`); return p;}
        p.setDialog = (dialog)=>{uPage.setText(dialog); return p;}
        p.updatePage = ()=>{
            const np = uPage.getNextPage();
            uText.setText(np);
            return uPage.isLastPage;
        }

        this._spkA = p;
        return this;
    }

    addSpeakerB(scene)
    {
        const p = ui.uPanel.call(this,scene,
                                    {bg:{color:GM.COLOR.DARK},
                                    space:UI.SPACE.LRTBI_10,
                                    ext:{expand:true,proportion:1}});

        const pic = ui.uPic.call(p,scene,{w:GM.PORTRAITS.W,h:GM.PORTRAITS.H,
                                        icon:'portraits/0',
                                        ext:{align:'top'}});

        const scroll = ui.uScroll.call(p,scene,{
                        ext:{expand:true,proportion:1}});

        p.setIcon = (icon)=>{pic.setIcon(icon); return p;}                  
        p.setDialog = (options)=>{
            scroll.clearAll();
            options.forEach(option=>{
                scroll.addItem(ui.uButton(scene,{
                    text:option.text,
                    ondown:()=>{this.owner.select(option, this.cb.bind(this))},
                    cDEF:GM.COLOR.WHITE,
                    space:0,
                    style:UI.BTN.ITEM}));
            })
            
            return p;
        }

        this._spkB=p;
        return this;

    }

    cb(cmd)
    {
        switch(cmd)
        {
            case 'exit': this.close(); return;
            case 'goto': this.updateDialog(); return;
            case 'next': this.updatePage(); return;
        }
    }

    updateDialog()
    {
        this.dialog = this.owner.getDialog(); 
        this._spkA.setDialog(this.dialog.A);
        this.updatePage();
    }

    updatePage()
    {
        const nxtp = [{text:'*聆聽...*',cmds:['next']}];
        const lastPage = this._spkA.updatePage();
        this._spkB.setDialog(lastPage ? this.dialog.B : nxtp);
        this.layout();
        return this;
    }

    close()
    {
        super.close();
        this.on(UI.TAG.MAIN);
    }

    show(owner)
    {
        this.owner = owner;
        this.dialog = owner.getDialog();
        super.show();
        this._spkA.setIcon(owner.icon).setName(owner.id.lab())
        this._spkB.setIcon(this.player.icon)
        this.updateDialog();
        this.closeAll(~GM.UI_MSG);
    }

    static show(owner) {if(this.instance) {this.instance.show(owner);}}
}