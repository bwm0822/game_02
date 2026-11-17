// prefab（docs/prefab.md）的共用小工具：ItemView、放置模式、場景分頁的 sandbox 都用

// 縮圖外框(相對錨點，左上角＋寬高)；沒有 thumb＝錨點在底部中間的 32×32
export const thumbOf = (pf)=>pf?.thumb ?? {x:-16, y:-32, w:32, h:32};

// 預設狀態看得到的 png 零件，照 depth 排(同 depth 照原順序)
export const defaultImgs = (pf)=>(pf?.parts ?? []).map((p, i)=>({p, i}))
    .filter(({p})=>p.img && (!p.look || p.look===pf.look))
    .sort((a, b)=>(a.p.depth ?? 0) - (b.p.depth ?? 0) || a.i - b.i)
    .map(({p})=>p);

// 放置模式的 ghost：預設狀態看得到的 png 零件(不含粒子、光源)，container 原點＝錨點
export function prefabGhost(scene, pf)
{
    const sps = defaultImgs(pf).filter(p=>scene.textures.exists(p.img.split(':')[0])).map(p=>{
        const [key, frame] = p.img.split(':');
        return scene.add.image(p.x ?? 0, p.y ?? 0, key, frame).setOrigin(p.ox ?? 0.5, p.oy ?? 1)
            .setScale(p.sx ?? 1, p.sy ?? 1).setFlipX(!!p.flip).setAngle(p.angle ?? 0);
    });
    return scene.add.container(0, 0, sps);
}
