import _ from './node_modules/key-tree/index';

export default function obsox(obj) {
  return obsox_(obj, [], true);
}

function obsox_(obj, path, force, tree) {
  if (obj._obsox && (!force)) return obj._obsox.proxy;
  return (new Obsox(obj, path, tree)).proxy;
}

class Obsox {
  constructor(obj, path, tree) {
    this.raw = obj;
    this.tree = tree || new _();
    this.path = path || [];
    this._proxy = new Proxy(obj, this);
    if (!this.tree._cache) {
      this.tree._counter = 0;
      this.tree._cache = {};
    }
    obj._obsox = this;
    obj.observe = (path, callback, options) => {
      const id = ++this.tree._counter;
      if (callback) {
        const keyPath = (path || '').trim();
        const cbo = { o: options || {}, cb: callback };
        this.tree._cache[id] = { keyPath, cbo };
        this.tree.add(keyPath, cbo);
      }
      return id;
    };
    obj.unobserve = (id) => {
      let cached = this.tree._cache[id];
      if (cached) {
        this.tree.remove(cached.keyPath, cached.cbo);
        delete this.tree._cache[id];
      }
    };
    obj.observeOnce = (path, callback, options) => {
      const ids = [];
      const cb = response => {
        this.raw.unobserve(ids[0]);
        try {
          if (callback)
            callback(response);
        } catch (err) { }
      }
      ids.push(this.raw.observe(path, cb, options));
      return ids[0];
    };
  }

  get proxy() {
    return this._proxy;
  }

  get(obj, prop, receiver) {
    const ret = Reflect.get(obj, prop, receiver);
    if (typeof ret === 'object') {
      return obsox_(ret, this.path.concat(prop), false, this.tree);
    }
    return ret;
  }

  set(obj, prop, value) {
    Reflect.set(obj, prop, value);
    let path = this.path.concat(prop).join('.');
    console.log("Set -> ", path);
  }
}