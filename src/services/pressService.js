// services/pressService.js
export default class PressService {
  static _timers = new Set();
  static _sceneBound = false;

  static bindToScene(scene) {
    if (this._sceneBound) return;
    this._sceneBound = true;
    scene.events.once('shutdown', () => this.reset());
  }

  static start(fn, delayMs) {
    const id = setTimeout(() => {
      this._timers.delete(id);
      fn();
    }, delayMs);
    this._timers.add(id);
    return id;
  }

  static cancel(id) {
    if (!id) return;
    clearTimeout(id);
    this._timers.delete(id);
  }

  static reset() {
    for (const id of this._timers) clearTimeout(id);
    this._timers.clear();
  }
}
