const LIMIT = 100;

// 快照只存參照：ops 陣列與 canvas 都不會被就地修改（每次操作都換新的）
export class History
{
    constructor() {this.undos = []; this.redos = [];}

    snap(layer)
    {
        const {x, y, a, ox, oy, ops, canvas} = layer;
        return {layer, x, y, a, ox, oy, ops, canvas};
    }

    push(s)
    {
        this.undos.push(s);
        if (this.undos.length > LIMIT) this.undos.shift();
        this.redos.length = 0;
    }

    record(layer) {this.push(this.snap(layer));}

    forget(layer)
    {
        this.undos = this.undos.filter(s => s.layer !== layer);
        this.redos = this.redos.filter(s => s.layer !== layer);
    }

    undo() {return this._swap(this.undos, this.redos);}
    redo() {return this._swap(this.redos, this.undos);}

    _swap(from, to)
    {
        const s = from.pop();
        if (!s) return null;
        to.push(this.snap(s.layer));
        History.restore(s);
        return s.layer;
    }

    static restore(s)
    {
        const {x, y, a, ox, oy, ops, canvas} = s;
        Object.assign(s.layer, {x, y, a, ox, oy, ops, canvas});
    }
}
