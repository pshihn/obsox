var obsox = (function () {
  'use strict';

  class TreeNode {
    constructor(parent, key, values) {
      this.key = key || '';
      this.values = [];
      this.children = [];
      this.parent = parent;
      this.appendValues(values);
    }
    get fullPath() {
      let ret = [];
      let current = this;
      while (current) {
        ret.splice(0, 0, current.key);
        current = current.parent;
      }
      return ret;
    }
    getChild(key) {
      for (const c of this.children) {
        if (key === c.key) {
          return c;
        }
      }
      return null;
    }
    ensureChild(key) {
      let child = this.getChild(key);
      if (!child) {
        child = new TreeNode(this, key);
        this.children.push(child);
      }
      return child;
    }
    addChild(key, values) {
      let child = this.getChild(key);
      if (!child) {
        child = new TreeNode(this, key, values);
        this.children.push(child);
      } else {
        child.appendValues(values);
      }
      return child;
    }
    appendValues(values) {
      if (typeof values === 'undefined') return;
      const vlist = Array.isArray(values) ? values : [values];
      this.values = this.values.concat(vlist);
    }
  }

  class KeyTree {
    constructor(options, values) {
      this.sep = (options && options.separator) || '.';
      this.$ = new TreeNode();
      if (values) {
        for (const key in values) {
          this.add(key, values[key]);
        }
      }
    }

    add(key, values) {
      let current = this.$;
      if (key === '') {
        current.appendValues(values);
        return;
      }
      let subKeys = (key || '').trim().split(this.sep);
      for (let i = 0; i < subKeys.length; i++) {
        if (i === (subKeys.length - 1)) {
          current = current.addChild(subKeys[i], values);
        } else {
          current = current.ensureChild(subKeys[i]);
        }
      }
    }

    _getNode(key) {
      let current = this.$;
      if (key !== '') {
        let subKeys = (key || '').trim().split(this.sep);
        for (let i = 0; i < subKeys.length; i++) {
          if (!current) {
            break;
          }
          current = current.getChild(subKeys[i]);
        }
      }
      return current;
    }

    get(key) {
      const node = this._getNode(key);
      return node ? node.values : [];
    }

    getSub(key, grouped) {
      let result = { grouped: {}, ungrouped: [] };
      this._reduce(key, this._getNode(key), result, true);
      return grouped ? result.grouped : result.ungrouped;
    }

    getSup(key, grouped) {
      let result = { grouped: {}, ungrouped: [] };
      this._reduce(key, this._getNode(key), result, false);
      return grouped ? result.grouped : result.ungrouped;
    }

    _reduce(keyPath, node, result, isSub) {
      if (!node) return;
      result.grouped[keyPath] = node.values;
      result.ungrouped = result.ungrouped.concat(node.values);
      if (isSub) {
        for (const c of node.children) {
          const ckey = `${keyPath}${this.sep}${c.key}`;
          this._reduce(ckey, c, result, isSub);
        }
      } else {
        const parent = node.parent;
        if (parent) {
          const pkey = parent.fullPath.join(this.sep);
          this._reduce(pkey, parent, result, isSub);
        }
      }
    }

    remove(key, value) {
      const node = this._getNode(key);
      let ret = false;
      if (node) {
        while (true) {
          let ix = -1;
          for (let i = 0; i < node.values.length; i++) {
            if (node.values[i] == value) {
              ix = i;
              break;
            }
          }
          if (ix >= 0) {
            node.values.splice(ix, 1);
            ret = true;
          } else {
            break;
          }
        }
      }
      return ret;
    }

    removeKey(key) {
      if (key) {
        const node = this._getNode(key);
        let ret = false;
        if (node) {
          ret = true;
          const parent = node.parent;
          let ix = -1;
          for (let i = 0; i < parent.children.length; i++) {
            let c = parent.children[i];
            if (c == node) {
              ix = i;
              break;
            }
          }
          if (ix >= 0) {
            parent.children.splice(ix, 1);
          }
        }
        return ret;
      } else {
        throw 'Cannot remove the root key';
      }
    }

    removeChildren(key) {
      const node = this._getNode(key);
      if (node) {
        node.children = [];
        return true;
      }
      return false;
    }

    clearKey(key, clearChildren) {
      const node = this._getNode(key);
      if (node) {
        this._clearNodeValues(node, clearChildren);
      }
    }

    _clearNodeValues(node, clearChildren) {
      node.values = [];
      if (clearChildren) {
        for (const c of node.children) {
          this._clearNodeValues(c, clearChildren);
        }
      }
    }
  }

  function obsox(obj) {
    return obsox_(obj, [], true);
  }

  function obsox_(obj, path, force, tree) {
    if (obj._obsox && (!force)) return obj._obsox.proxy;
    return (new Obsox(obj, path, tree)).proxy;
  }

  class Obsox {
    constructor(obj, path, tree) {
      this.raw = obj;
      this.tree = tree || new KeyTree();
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
        };
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

  return obsox;

}());
