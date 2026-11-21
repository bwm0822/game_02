// Phaser 的 PostFXPipeline.bindAndDraw() 合成時不設混色，沿用 GL 當下的狀態：
// container 裡最後畫的是 ADD（例如 prefab 的 local 火星粒子）時，掛外框（rexOutline）整塊被 ADD 到背景上變白。
// 合成前一律換回 NORMAL。
export function installPostFxBlend()
{
    const proto = Phaser.Renderer.WebGL.Pipelines.PostFXPipeline.prototype;
    const draw = proto.bindAndDraw;
    proto.bindAndDraw = function(...args)
    {
        this.renderer.setBlendMode(Phaser.BlendModes.NORMAL);
        return draw.apply(this, args);
    };
}
