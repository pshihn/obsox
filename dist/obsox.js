var obsox = (function () {
  'use strict';

  function obsox(obj) {
    return obsox_(obj, [], true);
  }

  function obsox_(obj, path, force) {
    if (obj._obsox && (!force)) return obj._obsox.proxy;
    return (new Obsox(obj, path)).proxy;
  }

  class Obsox {
    constructor(obj, path) {
      this._o = obj;
      this._path = path || [];
      obj._obsox = this;
      this._proxy = new Proxy(obj, this);
    }

    get proxy() {
      return this._proxy;
    }

    get(obj, prop, receiver) {
      const ret = Reflect.get(obj, prop, receiver);
      if (typeof ret === 'object') {
        return obsox_(ret, this._path.concat(prop));
      }
      console.log("get", this._path, ret);
      return ret;
    }

    set(obj, prop, value) {
      Reflect.set(obj, prop, value);
      console.log("set", this._path, prop, value);
    }
  }

  return obsox;

}());
