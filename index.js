import _ from './node_modules/key-tree/index';

export default function obsox(obj) {
  return obsox_(obj, [], true);
}

function obsox_(obj, path, force) {
  if (obj._obsox && (!force)) return obj._obsox.proxy;
  return (new Obsox(obj, path)).proxy;
}

class Obsox {
  constructor(obj, path) {
    this.raw = obj;
    this.path = path || [];
    obj._obsox = this;
    this._proxy = new Proxy(obj, this);
    this.tree = new _();
  }

  get proxy() {
    return this._proxy;
  }

  get(obj, prop, receiver) {
    const ret = Reflect.get(obj, prop, receiver);
    if (typeof ret === 'object') {
      return obsox_(ret, this.path.concat(prop));
    }
    return ret;
  }

  set(obj, prop, value) {
    Reflect.set(obj, prop, value);
  }
}