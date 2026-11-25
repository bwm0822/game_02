// 聚光燈：取代 Phaser 的 Light2D pipeline（同名，現有 setPipeline('Light2D') 不用改），每盞燈多吃 light.spot、light.flicker（擾動，見 setFlicker）
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

// 擾動：light.flicker＝{i（亮度最多掉幾成）, r（半徑最多縮幾成）, xy（中心最多偏幾 px）, hz（每秒約幾個雜訊點）, seed}，
//  只在畫面上抖：pipeline 上傳前換成擾動後的值、上傳完換回來（資料位置／半徑不動，拖曳、跟隨、把手照原樣）；
//  addLight 會從池子拿舊的燈，所以每個 addLight 都要跟著 setFlicker（沒有＝清掉），同 setSpot；再叫一次種子不變
export const FLICKER_DEF = {i:0.3, r:0.1, xy:2, hz:8};
export function setFlicker(light, f)
{
    if(!light) {return light;}
    if(!f || typeof f !== 'object') {light.flicker = null; return light;}
    const num = (v, d, lo, hi) => {v = v === undefined || v === null || v === '' ? d : +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;};
    const D = FLICKER_DEF;
    light.flicker = {i:num(f.i, D.i, 0, 1), r:num(f.r, D.r, 0, 1), xy:num(f.xy, D.xy, 0, 1000), hz:num(f.hz, D.hz, 0.1, 60), seed:light.flicker?.seed ?? Math.random() * 1000};
    return light;
}

// 平滑雜訊 0～1：整數點上的隨機值之間 smoothstep 內插
const hash = (n) => {const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s);};
export function noise(t)
{
    const k = Math.floor(t), u = t - k, s = u * u * (3 - 2 * u);
    return hash(k) * (1 - s) + hash(k + 1) * s;
}

// sec 秒時的擾動：亮度、半徑倍率（同一條雜訊，暗＝光圈小）＋位置偏移（x、y 各一條）
export function flickerAt(f, sec)
{
    const t = sec * f.hz + f.seed, n = noise(t);
    return {i:1 - f.i * n, r:1 - f.r * n, x:(noise(t + 101.3) * 2 - 1) * f.xy, y:(noise(t + 207.9) * 2 - 1) * f.xy};
}

// Tiled 自訂屬性是平的：flicker_i／flicker_r／flicker_xy／flicker_hz（寫了任一個就開，其他用預設）
const FLAT = ['i', 'r', 'xy', 'hz'];
export const flickerOf = (bb) => bb?.flicker
    ?? (FLAT.some(k => bb?.[`flicker_${k}`] !== undefined) ? Object.fromEntries(FLAT.map(k => [k, bb[`flicker_${k}`]])) : null);

class SpotLightPipeline extends Phaser.Renderer.WebGL.Pipelines.LightPipeline
{
    constructor(game)
    {
        super({game, fragShader:FRAG});
    }

    onRender(scene, camera)
    {
        // 擾動：換成這一幀的值，聚光燈那段用同一份排序算完才換回來
        const sec = this.game.loop.time / 1000, back = [];
        for(const l of scene.sys.lights?.lights ?? [])
        {
            if(!l.flicker) {continue;}
            const v = flickerAt(l.flicker, sec);
            back.push([l, l.x, l.y, l.radius, l.intensity]);
            l.x += v.x;
            l.y += v.y;
            l.radius *= v.r;
            l.intensity *= v.i;
        }
        super.onRender(scene, camera);
        if(this.lightsActive)
        {
            const lights = scene.sys.lights.getLights(camera);
            for(let i=0; i<lights.length; i++)
            {
                const [x, y, o, n] = spotCone(lights[i].light.spot);
                this.set4f(`uLights[${i}].cone`, x, y, o, n);
            }
        }
        for(const [l, x, y, r, i] of back) {l.x = x; l.y = y; l.radius = r; l.intensity = i;}
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
