import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM, UI} from '../core/setting.js'

export default class UiPopup extends UiFrame
{
    static instance = null;

    constructor(scene)
    {
        const config = {
            x: 10,
            y: 0,
            orientation: 'y',
            space: 10,
        };

        super(scene, config, UI.TAG.POPUP);

        UiPopup.instance = this;

        this.addBg(scene, {color: GM.COLOR.PRIMARY});

        this.setOrigin(0, 0)
            .layout()
            .hide();
    }

    push(msg, {wrapWidth=300, duration=3000, animDuration=300}={})
    {
        this.removeAll(true);

        ui.uBbc.call(this, this.scene, {
            text: msg,
            wrapWidth: wrapWidth,
            ext: {align: 'left'}
        });

        // 在 rexUI 裡，被 hide() 的元件會被標記為 hidden，
        // layout() 計算尺寸和位置時會跳過 hidden 的元件（不佔空間）。
        // 所以順序會影響結果：
        this.show().layout();   // 先 show()，再layout()，才會正確

        if (this._tween) {this._tween.stop();}

        this.scene.time.delayedCall(0, () => {
            const startY = -this.height;
            const endY = 10;

            this.y = startY;

            this._tween = this.scene.tweens.add({
                targets: this,
                y: endY,
                duration: animDuration,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    this._closeTween = this.scene.tweens.add({
                        targets: this,
                        y: startY,
                        duration: animDuration,
                        delay: duration,
                        ease: 'Quad.easeIn',
                        onComplete: () => {
                            this.hide();
                        }
                    });
                }
            });
        });

        return this;
    }

    static push(msg, options)
    {
        return this.instance?.push(msg, options);
    }
}
