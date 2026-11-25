// 聚光燈：取代 Phaser 的 Light2D pipeline（同名，現有 setPipeline('Light2D') 不用改），每盞燈多吃 light.spot、light.breath（呼吸，見 setBreath）
//   light.spot = {dir（度，0 右、順時針）, arc（光錐全寬，度；沒寫或 ≥360＝點光源）, soft（0～1，錐側邊淡出比例，預設 0.2）}
//   不叫 angle：Tiled 自訂屬性撞到 Container 本身的 angle 會直接轉物件、進不了 bb
// 距離衰減照 Phaser 原本的公式，錐的淡出跟它相乘
// 環境光＋燈光每通道超過 kKnee 後柔性壓縮、不超過 1（疊燈看得出更亮但不爆白）；
// 起壓點至少是環境光本身，環境光不會被壓暗（白天 0xffffff 照原樣）

const FRAG = `
#define SHADER_NAME SPOT_LIGHT_FS

precision mediump float;

struct Light
{
    vec2 position;
    vec3 color;
    float intensity;
    float radius;
    vec4 cone; /* dirX, dirY（gl 座標，y 朝上）, cos 外半角, cos 內半角；cos 外半角 < -1.5＝點光源 */
};

const int kMaxLights = %LIGHT_COUNT%;
const float kKnee = 0.8;

uniform vec4 uCamera;
uniform vec2 uResolution;
uniform sampler2D uMainSampler;
uniform sampler2D uNormSampler;
uniform vec3 uAmbientLightColor;
uniform Light uLights[kMaxLights];
uniform mat3 uInverseRotationMatrix;
uniform int uLightCount;

varying vec2 outTexCoord;
varying float outTexId;
varying float outTintEffect;
varying vec4 outTint;

void main ()
{
    vec3 finalColor = vec3(0.0, 0.0, 0.0);

    vec4 texel = vec4(outTint.bgr * outTint.a, outTint.a);
    vec4 texture = texture2D(uMainSampler, outTexCoord);
    vec4 color = texture * texel;

    if (outTintEffect == 1.0)
    {
        color.rgb = mix(texture.rgb, outTint.bgr * outTint.a, texture.a);
    }
    else if (outTintEffect == 2.0)
    {
        color = texel;
    }

    vec3 normalMap = texture2D(uNormSampler, outTexCoord).rgb;
    vec3 normal = normalize(uInverseRotationMatrix * vec3(normalMap * 2.0 - 1.0));
    vec2 res = vec2(min(uResolution.x, uResolution.y)) * uCamera.w;

    for (int index = 0; index < kMaxLights; ++index)
    {
        if (index < uLightCount)
        {
            Light light = uLights[index];
            vec3 lightDir = vec3((light.position.xy / res) - (gl_FragCoord.xy / res), 0.1);
            vec3 lightNormal = normalize(lightDir);
            float distToSurf = length(lightDir) * uCamera.w;
            float diffuseFactor = max(dot(normal, lightNormal), 0.0);
            float radius = (light.radius / res.x * uCamera.w) * uCamera.w;
            float attenuation = clamp(1.0 - distToSurf * distToSurf / (radius * radius), 0.0, 1.0);

            if (light.cone.z > -1.5)
            {
                vec2 d = gl_FragCoord.xy - light.position.xy;
                float len = length(d);
                if (len > 0.5)
                {
                    float c = dot(d / len, light.cone.xy);
                    attenuation *= smoothstep(light.cone.z, light.cone.w, c);
                }
            }

            vec3 diffuse = light.color * diffuseFactor;
            finalColor += (attenuation * diffuse) * light.intensity;
        }
    }

    vec3 total = uAmbientLightColor + finalColor;
    vec3 knee = max(vec3(kKnee), min(uAmbientLightColor, vec3(1.0)));
    vec3 room = max(1.0 - knee, vec3(0.0001));
    vec3 over = max(total - knee, 0.0);
    total = min(total, knee) + room * (1.0 - exp(-over / room));
    vec4 colorOutput = vec4(total, 1.0);

    gl_FragColor = color * vec4(colorOutput.rgb * colorOutput.a, colorOutput.a);
}
`;

// 回傳 [dirX, dirY, cosOuter, cosInner]（gl 座標 y 朝上，所以 dirY 取負）
export function spotCone(spot)
{
    const arc = spot?.arc;
    if(!(arc > 0) || arc >= 360) {return [1, 0, -2, -1];}
    const a = (spot.dir ?? 0) * Math.PI/180;
    const half = arc/2 * Math.PI/180;
    const soft = Math.min(1, Math.max(0, spot.soft ?? 0.2));
    const outer = Math.cos(half);
    const inner = Math.max(Math.cos(half*(1-soft)), outer + 1e-4);
    return [Math.cos(a), -Math.sin(a), outer, inner];
}

// 寫 light.spot；arc 沒寫或 ≥360 清掉＝點光源
export function setSpot(light, {dir, arc, soft} = {})
{
    if(!light) {return light;}
    light.spot = arc > 0 && arc < 360 ? {dir:dir ?? 0, arc, soft:soft ?? 0.2} : null;
    return light;
}

// 呼吸：light.breath＝{t（一次暗→亮→暗幾秒）, min（最暗＝基準的幾成，0～1）, ph（隨機起點）, base（基準亮度）}，
//  pipeline 每幀照時間算 intensity；addLight 會從池子拿舊的燈，所以每個 addLight 都要跟著 setBreath（沒有＝清掉），同 setSpot
//  base 沒給＝燈現在的 intensity；改基準（藏起來＝0）再叫一次，起點不變
export const BREATH_MIN = 0.6;
export function setBreath(light, breath, base)
{
    if(!light) {return light;}
    if(base !== undefined) {light.intensity = base;}
    else if(light.breath) {light.intensity = light.breath.base;}
    const t = +breath?.t;
    if(!(t > 0)) {light.breath = null; return light;}
    const min = Math.min(1, Math.max(0, breath.min ?? BREATH_MIN));
    light.breath = {t:Math.max(0.1, t), min, ph:light.breath?.ph ?? Math.random(), base:light.intensity};
    return light;
}

// 呼吸的倍率（min～1，平滑 cos），sec＝秒
export const breathAt = (b, sec) => b.min + (1 - b.min) * (0.5 + 0.5 * Math.cos(2 * Math.PI * (sec / b.t + b.ph)));

// Tiled 自訂屬性是平的：breath_t／breath_min
export const breathOf = (bb) => (bb?.breath ?? (bb?.breath_t ? {t:bb.breath_t, min:bb.breath_min} : null));

class SpotLightPipeline extends Phaser.Renderer.WebGL.Pipelines.LightPipeline
{
    constructor(game)
    {
        super({game, fragShader:FRAG});
    }

    onRender(scene, camera)
    {
        const sec = this.game.loop.time / 1000;
        for(const l of scene.sys.lights?.lights ?? []) {if(l.breath) {l.intensity = l.breath.base * breathAt(l.breath, sec);}}
        super.onRender(scene, camera);
        if(!this.lightsActive) {return;}
        const lights = scene.sys.lights.getLights(camera);
        for(let i=0; i<lights.length; i++)
        {
            const [x, y, o, n] = spotCone(lights[i].light.spot);
            this.set4f(`uLights[${i}].cone`, x, y, o, n);
        }
    }
}

// 在 game config 的 callbacks.postBoot 呼叫：把內建的 Light2D 換成聚光燈版
export function installSpotLight(game)
{
    const pm = game.renderer?.pipelines;
    if(!pm) {return;}
    const name = 'Light2D';
    pm.remove(name, true, false);
    pm.classes.set(name, SpotLightPipeline);
    pm.add(name, new SpotLightPipeline(game));
}
