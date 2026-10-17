const LIMIT = 100;

// 快照只存參照：ops 陣列與 canvas 都不會被就地修改（每次操作都換新的）
// 結構快照（合併）記圖層清單的複本：被合併的圖層物件原封不動，換回清單就還原
// 群組快照 {group: [...]}：一步操作同時動到圖層清單和某層的像素（裁切到新圖層），第一個成員決定 undo 後選哪層
export class History
{
    constructor() {this.undos = []; this.redos = [];}

    // vis：連顯示一起記（平常切換顯示不進 undo，自動模式會隱藏原圖層）
    snap(layer, vis = false)
    {
        const {x, y, a, ox, oy, ops, canvas} = layer;
        return vis ? {layer, x, y, a, ox, oy, ops, canvas, visible: layer.visible} : {layer, x, y, a, ox, oy, ops, canvas};
    }

    snapList(state) {return {state, layers: [...state.layers], active: state.active};}

    push(s)
    {
        this.undos.push(s);
        if (this.undos.length > LIMIT) this.undos.shift();
        this.redos.length = 0;
    }

    record(layer) {this.push(this.snap(layer));}

    // removed：圖層被刪掉，結構快照也要拿掉它，不然 undo 合併會把它復活
    forget(layer, removed = false)
    {
        this.undos = this.undos.map(s => History.drop(s, layer, removed)).filter(Boolean);
        this.redos = this.redos.map(s => History.drop(s, layer, removed)).filter(Boolean);
    }

    static drop(s, layer, removed = false)
    {
        if (s.group)
        {
            const group = s.group.map(m => History.drop(m, layer, removed)).filter(Boolean);
            return group.length ? {group} : null;
        }
        if (s.layer === layer) return null;
        return !removed || !s.state ? s : {...s, layers: s.layers.filter(L => L !== layer), active: s.active === layer ? null : s.active};
    }

    undo() {return this._swap(this.undos, this.redos);}
    redo() {return this._swap(this.redos, this.undos);}

    _again(s)
    {
        if (s.group) return {group: s.group.map(m => this._again(m))};
        return s.state ? this.snapList(s.state) : this.snap(s.layer, 'visible' in s);
    }

    _swap(from, to)
    {
        const s = from.pop();
        if (!s) return null;
        to.push(this._again(s));
        History.restore(s);
        const head = s.group ? s.group[0] : s;
        return head.layer ?? head.active;
    }

    static restore(s)
    {
        if (s.group) return s.group.forEach(m => History.restore(m));
        if (s.state) return Object.assign(s.state, {layers: [...s.layers], active: s.active});
        const {x, y, a, ox, oy, ops, canvas} = s;
        Object.assign(s.layer, {x, y, a, ox, oy, ops, canvas});
        if ('visible' in s) s.layer.visible = s.visible;
    }
}
