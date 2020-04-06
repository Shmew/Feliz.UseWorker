(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.Sort = {}));
}(this, (function (exports) { 'use strict';

  function isArrayLike(x) {
    return x != null && (Array.isArray(x) || ArrayBuffer.isView(x));
  }
  function isComparable(x) {
    return x != null && typeof x.CompareTo === "function";
  }
  function isEquatable(x) {
    return x != null && typeof x.Equals === "function";
  }
  function isHashable(x) {
    return x != null && typeof x.GetHashCode === "function";
  }
  function isDisposable(x) {
    return x != null && typeof x.Dispose === "function";
  }
  function tryGetValue(map, key, defaultValue) {
    return map.has(key) ? [true, map.get(key)] : [false, defaultValue];
  }
  function padWithZeros(i, length) {
    let str = i.toString(10);
    while (str.length < length) {
      str = "0" + str;
    }
    return str;
  }
  function dateOffset(date) {
    const date1 = date;
    return typeof date1.offset === "number" ? date1.offset : date.kind === 1
    ? 0 : date.getTimezoneOffset() * -60000;
  }
  class ObjectRef {
    static id(o) {
      if (!ObjectRef.idMap.has(o)) {
        ObjectRef.idMap.set(o, ++ObjectRef.count);
      }
      return ObjectRef.idMap.get(o);
    }
  }
  ObjectRef.idMap = new WeakMap();
  ObjectRef.count = 0;
  function stringHash(s) {
    let i = 0;
    let h = 5381;
    const len = s.length;
    while (i < len) {
      h = h * 33 ^ s.charCodeAt(i++);
    }
    return h;
  }
  function numberHash(x) {
    return x * 2654435761 | 0;
  }
  function combineHashCodes(hashes) {
    if (hashes.length === 0) {
      return 0;
    }
    return hashes.reduce((h1, h2) => {
      return (h1 << 5) + h1 ^ h2;
    });
  }
  function identityHash(x) {
    if (x == null) {
      return 0;
    }
    switch (typeof x) {
      case "boolean":
        return x ? 1 : 0;
      case "number":
        return numberHash(x);
      case "string":
        return stringHash(x);
      default:
        return numberHash(ObjectRef.id(x));
    }
  }
  function structuralHash(x) {
    if (x == null) {
      return 0;
    }
    switch (typeof x) {
      case "boolean":
        return x ? 1 : 0;
      case "number":
        return numberHash(x);
      case "string":
        return stringHash(x);
      default:
        {
          if (isHashable(x)) {
            return x.GetHashCode();
          } else if (isArrayLike(x)) {
            const len = x.length;
            const hashes = new Array(len);
            for (let i = 0; i < len; i++) {
              hashes[i] = structuralHash(x[i]);
            }
            return combineHashCodes(hashes);
          } else {
            return stringHash(String(x));
          }
        }
    }
  }
  function equalArraysWith(x, y, eq) {
    if (x == null) {
      return y == null;
    }
    if (y == null) {
      return false;
    }
    if (x.length !== y.length) {
      return false;
    }
    for (let i = 0; i < x.length; i++) {
      if (!eq(x[i], y[i])) {
        return false;
      }
    }
    return true;
  }
  function equalArrays(x, y) {
    return equalArraysWith(x, y, equals);
  }
  function equals(x, y) {
    if (x === y) {
      return true;
    } else if (x == null) {
      return y == null;
    } else if (y == null) {
      return false;
    } else if (typeof x !== "object") {
      return false;
    } else if (isEquatable(x)) {
      return x.Equals(y);
    } else if (isArrayLike(x)) {
      return isArrayLike(y) && equalArrays(x, y);
    } else if (x instanceof Date) {
      return y instanceof Date && compareDates(x, y) === 0;
    } else {
      return false;
    }
  }
  function compareDates(x, y) {
    let xtime;
    let ytime;
    if ("offset" in x && "offset" in y) {
      xtime = x.getTime();
      ytime = y.getTime();
    } else {
      xtime = x.getTime() + dateOffset(x);
      ytime = y.getTime() + dateOffset(y);
    }
    return xtime === ytime ? 0 : xtime < ytime ? -1 : 1;
  }
  function comparePrimitives(x, y) {
    return x === y ? 0 : x < y ? -1 : 1;
  }
  function compareArraysWith(x, y, comp) {
    if (x == null) {
      return y == null ? 0 : 1;
    }
    if (y == null) {
      return -1;
    }
    if (x.length !== y.length) {
      return x.length < y.length ? -1 : 1;
    }
    for (let i = 0, j = 0; i < x.length; i++) {
      j = comp(x[i], y[i]);
      if (j !== 0) {
        return j;
      }
    }
    return 0;
  }
  function compareArrays(x, y) {
    return compareArraysWith(x, y, compare);
  }
  function compare(x, y) {
    if (x === y) {
      return 0;
    } else if (x == null) {
      return y == null ? 0 : -1;
    } else if (y == null) {
      return 1;
    } else if (typeof x !== "object") {
      return x < y ? -1 : 1;
    } else if (isComparable(x)) {
      return x.CompareTo(y);
    } else if (isArrayLike(x) && isArrayLike(y)) {
      return compareArrays(x, y);
    } else if (x instanceof Date && y instanceof Date) {
      return compareDates(x, y);
    } else {
      return 1;
    }
  }
  function getItemFromDict(map, key) {
    if (map.has(key)) {
      return map.get(key);
    } else {
      throw new Error(`The given key '${key}' was not present in the dictionary.`);
    }
  }

  function sameType(x, y) {
    return y != null && Object.getPrototypeOf(x).constructor === Object.getPrototypeOf(y).constructor;
  }
  function inherits(subClass, superClass) {
    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  }
  function declare(cons, superClass) {
    inherits(cons, superClass || SystemObject);
    return cons;
  }
  function SystemObject() {
    return;
  }
  SystemObject.prototype.toString = function () {
    return "{" + Object.keys(this).map(k => k + " = " + String(this[k])).join(";\n ") + "}";
  };
  SystemObject.prototype.GetHashCode = function () {
    return identityHash(this);
  };
  SystemObject.prototype.Equals = function (other) {
    return this === other;
  };
  function compareList(self, other) {
    if (self === other) {
      return 0;
    } else {
      if (other == null) {
        return -1;
      }
      while (self.tail != null) {
        if (other.tail == null) {
          return 1;
        }
        const res = compare(self.head, other.head);
        if (res !== 0) {
          return res;
        }
        self = self.tail;
        other = other.tail;
      }
      return other.tail == null ? 0 : -1;
    }
  }
  class List {
    constructor(head, tail) {
      this.head = head;
      this.tail = tail;
    }
    toString() {
      return "[" + Array.from(this).join("; ") + "]";
    }
    toJSON() {
      return Array.from(this);
    }
    [Symbol.iterator]() {
      let cur = this;
      return {
        next: () => {
          const value = cur === null || cur === void 0 ? void 0 : cur.head;
          const done = (cur === null || cur === void 0 ? void 0 : cur.tail) == null;
          cur = cur === null || cur === void 0 ? void 0 : cur.tail;
          return {
            done,
            value
          };
        }
      };
    }
    GetHashCode() {
      const hashes = Array.from(this).map(structuralHash);
      return combineHashCodes(hashes);
    }
    Equals(other) {
      return compareList(this, other) === 0;
    }
    CompareTo(other) {
      return compareList(this, other);
    }
  }
  function Union(tag, name, ...fields) {
    this.tag = tag | 0;
    this.name = name;
    this.fields = fields;
  }
  Union.prototype.toString = function () {
    const len = this.fields.length;
    if (len === 0) {
      return this.name;
    } else if (len === 1) {
      return this.name + " " + String(this.fields[0]);
    } else {
      return this.name + " (" + this.fields.map(x => String(x)).join(",") + ")";
    }
  };
  Union.prototype.toJSON = function () {
    return this.fields.length === 0 ? this.name : [this.name].concat(this.fields);
  };
  Union.prototype.GetHashCode = function () {
    const hashes = this.fields.map(x => structuralHash(x));
    hashes.splice(0, 0, numberHash(this.tag));
    return combineHashCodes(hashes);
  };
  Union.prototype.Equals = function (other) {
    return this === other || sameType(this, other) && this.tag === other.tag && equalArrays(this.fields, other.fields);
  };
  Union.prototype.CompareTo = function (other) {
    if (this === other) {
      return 0;
    } else if (!sameType(this, other)) {
      return -1;
    } else if (this.tag === other.tag) {
      return compareArrays(this.fields, other.fields);
    } else {
      return this.tag < other.tag ? -1 : 1;
    }
  };
  function recordToJson(record, getFieldNames) {
    const o = {};
    const keys = getFieldNames == null ? Object.keys(record) : getFieldNames(record);
    for (let i = 0; i < keys.length; i++) {
      o[keys[i]] = record[keys[i]];
    }
    return o;
  }
  function recordEquals(self, other, getFieldNames) {
    if (self === other) {
      return true;
    } else if (!sameType(self, other)) {
      return false;
    } else {
      const thisNames = getFieldNames == null ? Object.keys(self) : getFieldNames(self);
      for (let i = 0; i < thisNames.length; i++) {
        if (!equals(self[thisNames[i]], other[thisNames[i]])) {
          return false;
        }
      }
      return true;
    }
  }
  function recordCompare(self, other, getFieldNames) {
    if (self === other) {
      return 0;
    } else if (!sameType(self, other)) {
      return -1;
    } else {
      const thisNames = getFieldNames == null ? Object.keys(self) : getFieldNames(self);
      for (let i = 0; i < thisNames.length; i++) {
        const result = compare(self[thisNames[i]], other[thisNames[i]]);
        if (result !== 0) {
          return result;
        }
      }
      return 0;
    }
  }
  function Record() {
    return;
  }
  Record.prototype.toString = function () {
    return "{" + Object.keys(this).map(k => k + " = " + String(this[k])).join(";\n ") + "}";
  };
  Record.prototype.toJSON = function () {
    return recordToJson(this);
  };
  Record.prototype.GetHashCode = function () {
    const hashes = Object.keys(this).map(k => structuralHash(this[k]));
    return combineHashCodes(hashes);
  };
  Record.prototype.Equals = function (other) {
    return recordEquals(this, other);
  };
  Record.prototype.CompareTo = function (other) {
    return recordCompare(this, other);
  };
  const FSharpRef = declare(function FSharpRef(contents) {
    this.contents = contents;
  }, Record);
  const Exception = declare(function Exception(message) {
    this.stack = Error().stack;
    this.message = message;
  }, SystemObject);
  function getFSharpExceptionFieldNames(self) {
    return Object.keys(self).filter(k => k !== "message" && k !== "stack");
  }
  const FSharpException = declare(function FSharpException() {
    Exception.call(this);
  }, Exception);
  FSharpException.prototype.toString = function () {
    const fieldNames = getFSharpExceptionFieldNames(this);
    const len = fieldNames.length;
    if (len === 0) {
      return this.message;
    } else if (len === 1) {
      return this.message + " " + String(this[fieldNames[0]]);
    } else {
      return this.message + " (" + fieldNames.map(k => String(this[k])).join(",") + ")";
    }
  };
  FSharpException.prototype.toJSON = function () {
    return recordToJson(this, getFSharpExceptionFieldNames);
  };
  FSharpException.prototype.GetHashCode = function () {
    const hashes = getFSharpExceptionFieldNames(this).map(k => structuralHash(this[k]));
    return combineHashCodes(hashes);
  };
  FSharpException.prototype.Equals = function (other) {
    return recordEquals(this, other, getFSharpExceptionFieldNames);
  };
  FSharpException.prototype.CompareTo = function (other) {
    return recordCompare(this, other, getFSharpExceptionFieldNames);
  };
  const MatchFailureException = declare(function MatchFailureException(arg1, arg2, arg3) {
    this.arg1 = arg1;
    this.arg2 = arg2 | 0;
    this.arg3 = arg3 | 0;
    this.message = "The match cases were incomplete";
  }, FSharpException);
  const Attribute = declare(function Attribute() {
    return;
  }, SystemObject);

  class Some {
    constructor(value) {
      this.value = value;
    }
    toString() {
      return String(this.value);
    }
    toJSON() {
      return this.value;
    }
    GetHashCode() {
      return structuralHash(this.value);
    }
    Equals(other) {
      if (other == null) {
        return false;
      } else {
        return equals(this.value, other instanceof Some ? other.value : other);
      }
    }
    CompareTo(other) {
      if (other == null) {
        return 1;
      } else {
        return compare(this.value, other instanceof Some ? other.value : other);
      }
    }
  }
  function value(x) {
    if (x == null) {
      throw new Error("Option has no value");
    } else {
      return x instanceof Some ? x.value : x;
    }
  }
  const Choice = declare(function Choice(tag, name, field) {
    Union.call(this, tag, name, field);
  }, Union);
  const Result = declare(function Result(tag, name, field) {
    Union.call(this, tag, name, field);
  }, Union);

  var P = {
    GetHashCode() {
      return combineHashCodes([this.s, this.e].concat(this.c));
    },
    Equals(x) {
      return !this.cmp(x);
    },
    CompareTo(x) {
      return this.cmp(x);
    }
  };
  var DP = 28,
  RM = 1,
  MAX_DP = 1E6,
  MAX_POWER = 1E6,
  NE = -29,
  PE = 29,
  NAME = "[big.js] ",
      INVALID = NAME + "Invalid ",
      INVALID_DP = INVALID + "decimal places",
      INVALID_RM = INVALID + "rounding mode",
      DIV_BY_ZERO = NAME + "Division by zero",
      UNDEFINED = void 0,
      NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
  function _Big_() {
    function Big(n) {
      var x = this;
      if (!(x instanceof Big)) return n === UNDEFINED ? _Big_() : new Big(n);
      if (n instanceof Big) {
        x.s = n.s;
        x.e = n.e;
        x.c = n.c.slice();
        normalize(x);
      } else {
        parse(x, n);
      }
      x.constructor = Big;
    }
    Big.prototype = P;
    Big.DP = DP;
    Big.RM = RM;
    Big.NE = NE;
    Big.PE = PE;
    Big.version = "5.2.2";
    return Big;
  }
  function normalize(x) {
    x = round(x, DP, 0);
    if (x.c.length > 1 && !x.c[0]) {
      let i = x.c.findIndex(x => x);
      x.c = x.c.slice(i);
      x.e = x.e - i;
    }
  }
  function parse(x, n) {
    var e, i, nl;
    if (n === 0 && 1 / n < 0) n = "-0";else if (!NUMERIC.test(n += "")) throw Error(INVALID + "number");
    x.s = n.charAt(0) == "-" ? (n = n.slice(1), -1) : 1;
    if ((e = n.indexOf(".")) > -1) n = n.replace(".", "");
    if ((i = n.search(/e/i)) > 0) {
      if (e < 0) e = i;
      e += +n.slice(i + 1);
      n = n.substring(0, i);
    } else if (e < 0) {
      e = n.length;
    }
    nl = n.length;
    for (i = 0; i < e && i < nl && n.charAt(i) == "0";) ++i;
    if (i == nl) {
      x.c = [x.e = 0];
    } else {
      x.e = e - i - 1;
      x.c = [];
      for (e = 0; i < nl;) x.c[e++] = +n.charAt(i++);
    }
    x = round(x, Big.DP, Big.RM);
    return x;
  }
  function round(x, dp, rm, more) {
    var xc = x.c,
        i = x.e + dp + 1;
    if (i < xc.length) {
      if (rm === 1) {
        more = xc[i] >= 5;
      } else if (rm === 2) {
        more = xc[i] > 5 || xc[i] == 5 && (more || i < 0 || xc[i + 1] !== UNDEFINED || xc[i - 1] & 1);
      } else if (rm === 3) {
        more = more || !!xc[0];
      } else {
        more = false;
        if (rm !== 0) throw Error(INVALID_RM);
      }
      if (i < 1) {
        xc.length = 1;
        if (more) {
          x.e = -dp;
          xc[0] = 1;
        } else {
          xc[0] = x.e = 0;
        }
      } else {
        xc.length = i--;
        if (more) {
          for (; ++xc[i] > 9;) {
            xc[i] = 0;
            if (!i--) {
              ++x.e;
              xc.unshift(1);
            }
          }
        }
        for (i = xc.length; !xc[--i];) xc.pop();
      }
    } else if (rm < 0 || rm > 3 || rm !== ~~rm) {
      throw Error(INVALID_RM);
    }
    return x;
  }
  function stringify(x, id, n, k) {
    var e,
        s,
        Big = x.constructor,
        z = !x.c[0];
    if (n !== UNDEFINED) {
      if (n !== ~~n || n < (id == 3) || n > MAX_DP) {
        throw Error(id == 3 ? INVALID + "precision" : INVALID_DP);
      }
      x = new Big(x);
      n = k - x.e;
      if (x.c.length > ++k) round(x, n, Big.RM);
      if (id == 2) k = x.e + n + 1;
      for (; x.c.length < k;) x.c.push(0);
    }
    e = x.e;
    s = x.c.join("");
    n = s.length;
    if (id != 2 && (id == 1 || id == 3 && k <= e || e <= Big.NE || e >= Big.PE)) {
      s = s.charAt(0) + (n > 1 ? "." + s.slice(1) : "") + (e < 0 ? "e" : "e+") + e;
    } else if (e < 0) {
      for (; ++e;) s = "0" + s;
      s = "0." + s;
    } else if (e > 0) {
      if (++e > n) for (e -= n; e--;) s += "0";else if (e < n) s = s.slice(0, e) + "." + s.slice(e);
    } else if (n > 1) {
      s = s.charAt(0) + "." + s.slice(1);
    }
    return x.s < 0 && (!z || id == 4) ? "-" + s : s;
  }
  P.abs = function () {
    var x = new this.constructor(this);
    x.s = 1;
    return x;
  };
  P.cmp = function (y) {
    var isneg,
        Big = this.constructor,
        x = new Big(this),
        y = new Big(y),
        xc = x.c,
        yc = y.c,
        i = x.s,
        j = y.s,
        k = x.e,
        l = y.e;
    if (!xc[0] || !yc[0]) return !xc[0] ? !yc[0] ? 0 : -j : i;
    if (i != j) return i;
    isneg = i < 0;
    if (k != l) return k > l ^ isneg ? 1 : -1;
    j = Math.max(xc.length, yc.length);
    for (i = 0; i < j; i++) {
      k = i < xc.length ? xc[i] : 0;
      l = i < yc.length ? yc[i] : 0;
      if (k != l) return k > l ^ isneg ? 1 : -1;
    }
    return 0;
  };
  P.div = function (y) {
    var Big = this.constructor,
        x = new Big(this),
        y = new Big(y),
        a = x.c,
    b = y.c,
    k = x.s == y.s ? 1 : -1,
        dp = Big.DP;
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
    if (!b[0]) throw Error(DIV_BY_ZERO);
    if (!a[0]) return new Big(k * 0);
    var bl,
        bt,
        n,
        cmp,
        ri,
        bz = b.slice(),
        ai = bl = b.length,
        al = a.length,
        r = a.slice(0, bl),
    rl = r.length,
        q = y,
    qc = q.c = [],
        qi = 0,
        d = dp + (q.e = x.e - y.e) + 1;
    q.s = k;
    k = d < 0 ? 0 : d;
    bz.unshift(0);
    for (; rl++ < bl;) r.push(0);
    do {
      for (n = 0; n < 10; n++) {
        if (bl != (rl = r.length)) {
          cmp = bl > rl ? 1 : -1;
        } else {
          for (ri = -1, cmp = 0; ++ri < bl;) {
            if (b[ri] != r[ri]) {
              cmp = b[ri] > r[ri] ? 1 : -1;
              break;
            }
          }
        }
        if (cmp < 0) {
          for (bt = rl == bl ? b : bz; rl;) {
            if (r[--rl] < bt[rl]) {
              ri = rl;
              for (; ri && !r[--ri];) r[ri] = 9;
              --r[ri];
              r[rl] += 10;
            }
            r[rl] -= bt[rl];
          }
          for (; !r[0];) r.shift();
        } else {
          break;
        }
      }
      qc[qi++] = cmp ? n : ++n;
      if (r[0] && cmp) r[rl] = a[ai] || 0;else r = [a[ai]];
    } while ((ai++ < al || r[0] !== UNDEFINED) && k--);
    if (!qc[0] && qi != 1) {
      qc.shift();
      q.e--;
    }
    if (qi > d) round(q, dp, Big.RM, r[0] !== UNDEFINED);
    return q;
  };
  P.eq = function (y) {
    return !this.cmp(y);
  };
  P.gt = function (y) {
    return this.cmp(y) > 0;
  };
  P.gte = function (y) {
    return this.cmp(y) > -1;
  };
  P.lt = function (y) {
    return this.cmp(y) < 0;
  };
  P.lte = function (y) {
    return this.cmp(y) < 1;
  };
  P.minus = P.sub = function (y) {
    var i,
        j,
        t,
        xlty,
        Big = this.constructor,
        x = new Big(this),
        y = new Big(y),
        a = x.s,
        b = y.s;
    if (a != b) {
      y.s = -b;
      return x.plus(y);
    }
    var xc = x.c.slice(),
        xe = x.e,
        yc = y.c,
        ye = y.e;
    if (!xc[0] || !yc[0]) {
      return yc[0] ? (y.s = -b, y) : new Big(xc[0] ? x : 0);
    }
    if (a = xe - ye) {
      if (xlty = a < 0) {
        a = -a;
        t = xc;
      } else {
        ye = xe;
        t = yc;
      }
      t.reverse();
      for (b = a; b--;) t.push(0);
      t.reverse();
    } else {
      j = ((xlty = xc.length < yc.length) ? xc : yc).length;
      for (a = b = 0; b < j; b++) {
        if (xc[b] != yc[b]) {
          xlty = xc[b] < yc[b];
          break;
        }
      }
    }
    if (xlty) {
      t = xc;
      xc = yc;
      yc = t;
      y.s = -y.s;
    }
    if ((b = (j = yc.length) - (i = xc.length)) > 0) for (; b--;) xc[i++] = 0;
    for (b = i; j > a;) {
      if (xc[--j] < yc[j]) {
        for (i = j; i && !xc[--i];) xc[i] = 9;
        --xc[i];
        xc[j] += 10;
      }
      xc[j] -= yc[j];
    }
    for (; xc[--b] === 0;) xc.pop();
    for (; xc[0] === 0;) {
      xc.shift();
      --ye;
    }
    if (!xc[0]) {
      y.s = 1;
      xc = [ye = 0];
    }
    y.c = xc;
    y.e = ye;
    return y;
  };
  P.mod = function (y) {
    var ygtx,
        Big = this.constructor,
        x = new Big(this),
        y = new Big(y),
        a = x.s,
        b = y.s;
    if (!y.c[0]) throw Error(DIV_BY_ZERO);
    x.s = y.s = 1;
    ygtx = y.cmp(x) == 1;
    x.s = a;
    y.s = b;
    if (ygtx) return new Big(x);
    a = Big.DP;
    b = Big.RM;
    Big.DP = Big.RM = 0;
    x = x.div(y);
    Big.DP = a;
    Big.RM = b;
    return this.minus(x.times(y));
  };
  P.plus = P.add = function (y) {
    var t,
        Big = this.constructor,
        x = new Big(this),
        y = new Big(y),
        a = x.s,
        b = y.s;
    if (a != b) {
      y.s = -b;
      return x.minus(y);
    }
    var xe = x.e,
        xc = x.c,
        ye = y.e,
        yc = y.c;
    if (!xc[0] || !yc[0]) return yc[0] ? y : new Big(xc[0] ? x : a * 0);
    xc = xc.slice();
    if (a = xe - ye) {
      if (a > 0) {
        ye = xe;
        t = yc;
      } else {
        a = -a;
        t = xc;
      }
      t.reverse();
      for (; a--;) t.push(0);
      t.reverse();
    }
    if (xc.length - yc.length < 0) {
      t = yc;
      yc = xc;
      xc = t;
    }
    a = yc.length;
    for (b = 0; a; xc[a] %= 10) b = (xc[--a] = xc[a] + yc[a] + b) / 10 | 0;
    if (b) {
      xc.unshift(b);
      ++ye;
    }
    for (a = xc.length; xc[--a] === 0;) xc.pop();
    y.c = xc;
    y.e = ye;
    return y;
  };
  P.pow = function (n) {
    var Big = this.constructor,
        x = new Big(this),
        y = new Big(1),
        one = new Big(1),
        isneg = n < 0;
    if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) throw Error(INVALID + "exponent");
    if (isneg) n = -n;
    for (;;) {
      if (n & 1) y = y.times(x);
      n >>= 1;
      if (!n) break;
      x = x.times(x);
    }
    return isneg ? one.div(y) : y;
  };
  P.round = function (dp, rm) {
    var Big = this.constructor;
    if (dp === UNDEFINED) dp = 0;else if (dp !== ~~dp || dp < -MAX_DP || dp > MAX_DP) throw Error(INVALID_DP);
    return round(new Big(this), dp, rm === UNDEFINED ? Big.RM : rm);
  };
  P.sqrt = function () {
    var r,
        c,
        t,
        Big = this.constructor,
        x = new Big(this),
        s = x.s,
        e = x.e,
        half = new Big(0.5);
    if (!x.c[0]) return new Big(x);
    if (s < 0) throw Error(NAME + "No square root");
    s = Math.sqrt(x + "");
    if (s === 0 || s === 1 / 0) {
      c = x.c.join("");
      if (!(c.length + e & 1)) c += "0";
      s = Math.sqrt(c);
      e = ((e + 1) / 2 | 0) - (e < 0 || e & 1);
      r = new Big((s == 1 / 0 ? "1e" : (s = s.toExponential()).slice(0, s.indexOf("e") + 1)) + e);
    } else {
      r = new Big(s);
    }
    e = r.e + (Big.DP += 4);
    do {
      t = r;
      r = half.times(t.plus(x.div(t)));
    } while (t.c.slice(0, e).join("") !== r.c.slice(0, e).join(""));
    return round(r, Big.DP -= 4, Big.RM);
  };
  P.times = P.mul = function (y) {
    var c,
        Big = this.constructor,
        x = new Big(this),
        y = new Big(y),
        xc = x.c,
        yc = y.c,
        a = xc.length,
        b = yc.length,
        i = x.e,
        j = y.e;
    y.s = x.s == y.s ? 1 : -1;
    if (!xc[0] || !yc[0]) return new Big(y.s * 0);
    y.e = i + j;
    if (a < b) {
      c = xc;
      xc = yc;
      yc = c;
      j = a;
      a = b;
      b = j;
    }
    for (c = new Array(j = a + b); j--;) c[j] = 0;
    for (i = b; i--;) {
      b = 0;
      for (j = a + i; j > i;) {
        b = c[j] + yc[i] * xc[j - i - 1] + b;
        c[j--] = b % 10;
        b = b / 10 | 0;
      }
      c[j] = (c[j] + b) % 10;
    }
    if (b) ++y.e;else c.shift();
    for (i = c.length; !c[--i];) c.pop();
    y.c = c;
    return y;
  };
  P.toExponential = function (dp) {
    return stringify(this, 1, dp, dp);
  };
  P.toFixed = function (dp) {
    return stringify(this, 2, dp, this.e + dp);
  };
  P.toPrecision = function (sd) {
    return stringify(this, 3, sd, sd - 1);
  };
  P.toString = function () {
    return stringify(this);
  };
  P.valueOf = P.toJSON = function () {
    return stringify(this, 4);
  };
  var Big = _Big_();

  const get_Zero = new Big(0);
  const get_One = new Big(1);
  const get_MinusOne = new Big(-1);
  const get_MaxValue = new Big("79228162514264337593543950335");
  const get_MinValue = new Big("-79228162514264337593543950335");

  var NumberStyles;
  (function (NumberStyles) {
    NumberStyles[NumberStyles["AllowHexSpecifier"] = 512] = "AllowHexSpecifier";
  })(NumberStyles || (NumberStyles = {}));

  var wasm = null;
  try {
    wasm = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 13, 2, 96, 0, 1, 127, 96, 4, 127, 127, 127, 127, 1, 127, 3, 7, 6, 0, 1, 1, 1, 1, 1, 6, 6, 1, 127, 1, 65, 0, 11, 7, 50, 6, 3, 109, 117, 108, 0, 1, 5, 100, 105, 118, 95, 115, 0, 2, 5, 100, 105, 118, 95, 117, 0, 3, 5, 114, 101, 109, 95, 115, 0, 4, 5, 114, 101, 109, 95, 117, 0, 5, 8, 103, 101, 116, 95, 104, 105, 103, 104, 0, 0, 10, 191, 1, 6, 4, 0, 35, 0, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 126, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 127, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 128, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 129, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 130, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11])), {}).exports;
  } catch (e) {}
  function Long(low, high, unsigned) {
    this.low = low | 0;
    this.high = high | 0;
    this.unsigned = !!unsigned;
  }
  Long.prototype.GetHashCode = function () {
    let h1 = this.unsigned ? 1 : 0;
    h1 = (h1 << 5) + h1 ^ this.high;
    h1 = (h1 << 5) + h1 ^ this.low;
    return h1;
  };
  Long.prototype.Equals = function (x) {
    return equals$1(this, x);
  };
  Long.prototype.CompareTo = function (x) {
    return compare$1(this, x);
  };
  Long.prototype.toString = function (radix) {
    return toString(this, radix);
  };
  Long.prototype.toJSON = function () {
    return toString(this);
  };
  Object.defineProperty(Long.prototype, "__isLong__", {
    value: true
  });
  function isLong(obj) {
    return (obj && obj["__isLong__"]) === true;
  }
  var INT_CACHE = {};
  var UINT_CACHE = {};
  function fromInt(value, unsigned) {
    var obj, cachedObj, cache;
    if (unsigned) {
      value >>>= 0;
      if (cache = 0 <= value && value < 256) {
        cachedObj = UINT_CACHE[value];
        if (cachedObj) return cachedObj;
      }
      obj = fromBits(value, (value | 0) < 0 ? -1 : 0, true);
      if (cache) UINT_CACHE[value] = obj;
      return obj;
    } else {
      value |= 0;
      if (cache = -128 <= value && value < 128) {
        cachedObj = INT_CACHE[value];
        if (cachedObj) return cachedObj;
      }
      obj = fromBits(value, value < 0 ? -1 : 0, false);
      if (cache) INT_CACHE[value] = obj;
      return obj;
    }
  }
  function fromNumber(value, unsigned) {
    if (isNaN(value)) return unsigned ? UZERO : ZERO;
    if (unsigned) {
      if (value < 0) return UZERO;
      if (value >= TWO_PWR_64_DBL) return MAX_UNSIGNED_VALUE;
    } else {
      if (value <= -TWO_PWR_63_DBL) return MIN_VALUE;
      if (value + 1 >= TWO_PWR_63_DBL) return MAX_VALUE;
    }
    if (value < 0) return negate(fromNumber(-value, unsigned));
    return fromBits(value % TWO_PWR_32_DBL | 0, value / TWO_PWR_32_DBL | 0, unsigned);
  }
  function fromBits(lowBits, highBits, unsigned) {
    return new Long(lowBits, highBits, unsigned);
  }
  var pow_dbl = Math.pow;
  function fromString(str, unsigned, radix) {
    if (str.length === 0) throw Error("empty string");
    if (str === "NaN" || str === "Infinity" || str === "+Infinity" || str === "-Infinity") return ZERO;
    if (typeof unsigned === "number") {
      radix = unsigned, unsigned = false;
    } else {
      unsigned = !!unsigned;
    }
    radix = radix || 10;
    if (radix < 2 || 36 < radix) throw RangeError("radix");
    var p = str.indexOf("-");
    if (p > 0) throw Error("interior hyphen");else if (p === 0) {
      return negate(fromString(str.substring(1), unsigned, radix));
    }
    var radixToPower = fromNumber(pow_dbl(radix, 8));
    var result = ZERO;
    for (var i = 0; i < str.length; i += 8) {
      var size = Math.min(8, str.length - i),
          value = parseInt(str.substring(i, i + size), radix);
      if (size < 8) {
        var power = fromNumber(pow_dbl(radix, size));
        result = add(multiply(result, power), fromNumber(value));
      } else {
        result = multiply(result, radixToPower);
        result = add(result, fromNumber(value));
      }
    }
    result.unsigned = unsigned;
    return result;
  }
  function fromValue(val, unsigned) {
    if (typeof val === "number") return fromNumber(val, unsigned);
    if (typeof val === "string") return fromString(val, unsigned);
    return fromBits(val.low, val.high, typeof unsigned === "boolean" ? unsigned : val.unsigned);
  }
  var TWO_PWR_16_DBL = 1 << 16;
  var TWO_PWR_24_DBL = 1 << 24;
  var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;
  var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;
  var TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2;
  var TWO_PWR_24 = fromInt(TWO_PWR_24_DBL);
  var ZERO = fromInt(0);
  var UZERO = fromInt(0, true);
  var ONE = fromInt(1);
  var UONE = fromInt(1, true);
  var NEG_ONE = fromInt(-1);
  var MAX_VALUE = fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0, false);
  var MAX_UNSIGNED_VALUE = fromBits(0xFFFFFFFF | 0, 0xFFFFFFFF | 0, true);
  var MIN_VALUE = fromBits(0, 0x80000000 | 0, false);
  function toInt($this) {
    return $this.unsigned ? $this.low >>> 0 : $this.low;
  }
  function toNumber($this) {
    if ($this.unsigned) return ($this.high >>> 0) * TWO_PWR_32_DBL + ($this.low >>> 0);
    return $this.high * TWO_PWR_32_DBL + ($this.low >>> 0);
  }
  function toString($this, radix) {
    radix = radix || 10;
    if (radix < 2 || 36 < radix) throw RangeError("radix");
    if (isZero($this)) return "0";
    if (isNegative($this)) {
      if (equals$1($this, MIN_VALUE)) {
        var radixLong = fromNumber(radix),
            div = divide($this, radixLong),
            rem1 = subtract(multiply(div, radixLong), $this);
        return toString(div, radix) + toInt(rem1).toString(radix);
      } else return "-" + toString(negate($this), radix);
    }
    var radixToPower = fromNumber(pow_dbl(radix, 6), $this.unsigned),
        rem = $this;
    var result = "";
    while (true) {
      var remDiv = divide(rem, radixToPower),
          intval = toInt(subtract(rem, multiply(remDiv, radixToPower))) >>> 0,
          digits = intval.toString(radix);
      rem = remDiv;
      if (isZero(rem)) return digits + result;else {
        while (digits.length < 6) digits = "0" + digits;
        result = "" + digits + result;
      }
    }
  }
  function isZero($this) {
    return $this.high === 0 && $this.low === 0;
  }
  function isNegative($this) {
    return !$this.unsigned && $this.high < 0;
  }
  function isOdd($this) {
    return ($this.low & 1) === 1;
  }
  function equals$1($this, other) {
    if (!isLong(other)) other = fromValue(other);
    if ($this.unsigned !== other.unsigned && $this.high >>> 31 === 1 && other.high >>> 31 === 1) return false;
    return $this.high === other.high && $this.low === other.low;
  }
  function lessThan($this, other) {
    return compare$1($this,
    other) < 0;
  }
  function greaterThan($this, other) {
    return compare$1($this,
    other) > 0;
  }
  function greaterThanOrEqual($this, other) {
    return compare$1($this,
    other) >= 0;
  }
  function compare$1($this, other) {
    if (!isLong(other)) other = fromValue(other);
    if (equals$1($this, other)) return 0;
    var thisNeg = isNegative($this),
        otherNeg = isNegative(other);
    if (thisNeg && !otherNeg) return -1;
    if (!thisNeg && otherNeg) return 1;
    if (!$this.unsigned) return isNegative(subtract($this, other)) ? -1 : 1;
    return other.high >>> 0 > $this.high >>> 0 || other.high === $this.high && other.low >>> 0 > $this.low >>> 0 ? -1 : 1;
  }
  function negate($this) {
    if (!$this.unsigned && equals$1($this, MIN_VALUE)) return MIN_VALUE;
    return add(not($this), ONE);
  }
  function add($this, addend) {
    if (!isLong(addend)) addend = fromValue(addend);
    var a48 = $this.high >>> 16;
    var a32 = $this.high & 0xFFFF;
    var a16 = $this.low >>> 16;
    var a00 = $this.low & 0xFFFF;
    var b48 = addend.high >>> 16;
    var b32 = addend.high & 0xFFFF;
    var b16 = addend.low >>> 16;
    var b00 = addend.low & 0xFFFF;
    var c48 = 0,
        c32 = 0,
        c16 = 0,
        c00 = 0;
    c00 += a00 + b00;
    c16 += c00 >>> 16;
    c00 &= 0xFFFF;
    c16 += a16 + b16;
    c32 += c16 >>> 16;
    c16 &= 0xFFFF;
    c32 += a32 + b32;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c48 += a48 + b48;
    c48 &= 0xFFFF;
    return fromBits(c16 << 16 | c00, c48 << 16 | c32, $this.unsigned);
  }
  function subtract($this, subtrahend) {
    if (!isLong(subtrahend)) subtrahend = fromValue(subtrahend);
    return add($this, negate(subtrahend));
  }
  function multiply($this, multiplier) {
    if (isZero($this)) return $this.unsigned ? UZERO : ZERO;
    if (!isLong(multiplier)) multiplier = fromValue(multiplier);
    if (wasm) {
      var low = wasm.mul($this.low, $this.high, multiplier.low, multiplier.high);
      return fromBits(low, wasm.get_high(), $this.unsigned);
    }
    if (isZero(multiplier)) return $this.unsigned ? UZERO : ZERO;
    if (equals$1($this, MIN_VALUE)) return isOdd(multiplier) ? MIN_VALUE : ZERO;
    if (equals$1(multiplier, MIN_VALUE)) return isOdd($this) ? MIN_VALUE : ZERO;
    if (isNegative($this)) {
      if (isNegative(multiplier)) return multiply(negate($this), negate(multiplier));else return negate(multiply(negate($this), multiplier));
    } else if (isNegative(multiplier)) return negate(multiply($this, negate(multiplier)));
    if (lessThan($this, TWO_PWR_24) && lessThan(multiplier, TWO_PWR_24)) return fromNumber(toNumber($this) * toNumber(multiplier), $this.unsigned);
    var a48 = $this.high >>> 16;
    var a32 = $this.high & 0xFFFF;
    var a16 = $this.low >>> 16;
    var a00 = $this.low & 0xFFFF;
    var b48 = multiplier.high >>> 16;
    var b32 = multiplier.high & 0xFFFF;
    var b16 = multiplier.low >>> 16;
    var b00 = multiplier.low & 0xFFFF;
    var c48 = 0,
        c32 = 0,
        c16 = 0,
        c00 = 0;
    c00 += a00 * b00;
    c16 += c00 >>> 16;
    c00 &= 0xFFFF;
    c16 += a16 * b00;
    c32 += c16 >>> 16;
    c16 &= 0xFFFF;
    c16 += a00 * b16;
    c32 += c16 >>> 16;
    c16 &= 0xFFFF;
    c32 += a32 * b00;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c32 += a16 * b16;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c32 += a00 * b32;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
    c48 &= 0xFFFF;
    return fromBits(c16 << 16 | c00, c48 << 16 | c32, $this.unsigned);
  }
  function divide($this, divisor) {
    if (!isLong(divisor)) divisor = fromValue(divisor);
    if (isZero(divisor)) throw Error("division by zero");
    if (wasm) {
      if (!$this.unsigned && $this.high === -0x80000000 && divisor.low === -1 && divisor.high === -1) {
        return $this;
      }
      var low = ($this.unsigned ? wasm.div_u : wasm.div_s)($this.low, $this.high, divisor.low, divisor.high);
      return fromBits(low, wasm.get_high(), $this.unsigned);
    }
    if (isZero($this)) return $this.unsigned ? UZERO : ZERO;
    var approx, rem, res;
    if (!$this.unsigned) {
      if (equals$1($this, MIN_VALUE)) {
        if (equals$1(divisor, ONE) || equals$1(divisor, NEG_ONE)) return MIN_VALUE;
        else if (equals$1(divisor, MIN_VALUE)) return ONE;else {
            var halfThis = shiftRight($this, 1);
            approx = shiftLeft(divide(halfThis, divisor), 1);
            if (equals$1(approx, ZERO)) {
              return isNegative(divisor) ? ONE : NEG_ONE;
            } else {
              rem = subtract($this, multiply(divisor, approx));
              res = add(approx, divide(rem, divisor));
              return res;
            }
          }
      } else if (equals$1(divisor, MIN_VALUE)) return $this.unsigned ? UZERO : ZERO;
      if (isNegative($this)) {
        if (isNegative(divisor)) return divide(negate($this), negate(divisor));
        return negate(divide(negate($this), divisor));
      } else if (isNegative(divisor)) return negate(divide($this, negate(divisor)));
      res = ZERO;
    } else {
      if (!divisor.unsigned) divisor = toUnsigned(divisor);
      if (greaterThan(divisor, $this)) return UZERO;
      if (greaterThan(divisor, shiftRightUnsigned($this, 1)))
        return UONE;
      res = UZERO;
    }
    rem = $this;
    while (greaterThanOrEqual(rem, divisor)) {
      approx = Math.max(1, Math.floor(toNumber(rem) / toNumber(divisor)));
      var log2 = Math.ceil(Math.log(approx) / Math.LN2),
          delta = log2 <= 48 ? 1 : pow_dbl(2, log2 - 48),
      approxRes = fromNumber(approx),
          approxRem = multiply(approxRes, divisor);
      while (isNegative(approxRem) || greaterThan(approxRem, rem)) {
        approx -= delta;
        approxRes = fromNumber(approx, $this.unsigned);
        approxRem = multiply(approxRes, divisor);
      }
      if (isZero(approxRes)) approxRes = ONE;
      res = add(res, approxRes);
      rem = subtract(rem, approxRem);
    }
    return res;
  }
  function not($this) {
    return fromBits(~$this.low, ~$this.high, $this.unsigned);
  }
  function shiftLeft($this, numBits) {
    if (isLong(numBits)) numBits = toInt(numBits);
    if ((numBits &= 63) === 0) return $this;else if (numBits < 32) return fromBits($this.low << numBits, $this.high << numBits | $this.low >>> 32 - numBits, $this.unsigned);else return fromBits(0, $this.low << numBits - 32, $this.unsigned);
  }
  function shiftRight($this, numBits) {
    if (isLong(numBits)) numBits = toInt(numBits);
    if ((numBits &= 63) === 0) return $this;else if (numBits < 32) return fromBits($this.low >>> numBits | $this.high << 32 - numBits, $this.high >> numBits, $this.unsigned);else return fromBits($this.high >> numBits - 32, $this.high >= 0 ? 0 : -1, $this.unsigned);
  }
  function shiftRightUnsigned($this, numBits) {
    if (isLong(numBits)) numBits = toInt(numBits);
    numBits &= 63;
    if (numBits === 0) return $this;else {
      var high = $this.high;
      if (numBits < 32) {
        var low = $this.low;
        return fromBits(low >>> numBits | high << 32 - numBits, high >>> numBits, $this.unsigned);
      } else if (numBits === 32) return fromBits(high, 0, $this.unsigned);else return fromBits(high >>> numBits - 32, 0, $this.unsigned);
    }
  }
  function toUnsigned($this) {
    if ($this.unsigned) return $this;
    return fromBits($this.low, $this.high, true);
  }
  function toBytes($this, le) {
    return le ? toBytesLE($this) : toBytesBE($this);
  }
  function toBytesLE($this) {
    var hi = $this.high,
        lo = $this.low;
    return [lo & 0xff, lo >>> 8 & 0xff, lo >>> 16 & 0xff, lo >>> 24, hi & 0xff, hi >>> 8 & 0xff, hi >>> 16 & 0xff, hi >>> 24];
  }
  function toBytesBE($this) {
    var hi = $this.high,
        lo = $this.low;
    return [hi >>> 24, hi >>> 16 & 0xff, hi >>> 8 & 0xff, hi & 0xff, lo >>> 24, lo >>> 16 & 0xff, lo >>> 8 & 0xff, lo & 0xff];
  }
  function fromBytes(bytes, unsigned, le) {
    return le ? fromBytesLE(bytes, unsigned) : fromBytesBE(bytes, unsigned);
  }
  function fromBytesLE(bytes, unsigned) {
    return new Long(bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24, bytes[4] | bytes[5] << 8 | bytes[6] << 16 | bytes[7] << 24, unsigned);
  }
  function fromBytesBE(bytes, unsigned) {
    return new Long(bytes[4] << 24 | bytes[5] << 16 | bytes[6] << 8 | bytes[7], bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], unsigned);
  }

  const Long$1 = Long;
  const op_Multiply = multiply;
  const compare$2 = compare$1;
  const fromBytes$1 = fromBytes;
  const toBytes$1 = toBytes;
  const toString$1 = toString;

  class Enumerator {
    constructor(iter) {
      this.iter = iter;
    }
    MoveNext() {
      const cur = this.iter.next();
      this.current = cur.value;
      return !cur.done;
    }
    get Current() {
      return this.current;
    }
    Reset() {
      throw new Error("JS iterators cannot be reset");
    }
    Dispose() {
      return;
    }
  }
  function getEnumerator(o) {
    return new Enumerator(o[Symbol.iterator]());
  }
  function toIterator(en) {
    return {
      next() {
        return en.MoveNext() ? {
          done: false,
          value: en.Current
        } : {
          done: true,
          value: null
        };
      }
    };
  }
  function makeSeq(f) {
    const seq = {
      [Symbol.iterator]: f,
      toString: () => "seq [" + Array.from(seq).join("; ") + "]"
    };
    return seq;
  }
  function concat(xs) {
    return delay(() => {
      const iter = xs[Symbol.iterator]();
      let output = {
        value: null
      };
      return unfold(innerIter => {
        let hasFinished = false;
        while (!hasFinished) {
          if (innerIter == null) {
            const cur = iter.next();
            if (!cur.done) {
              innerIter = cur.value[Symbol.iterator]();
            } else {
              hasFinished = true;
            }
          } else {
            const cur = innerIter.next();
            if (!cur.done) {
              output = {
                value: cur.value
              };
              hasFinished = true;
            } else {
              innerIter = null;
            }
          }
        }
        return innerIter != null && output != null ? [output.value, innerIter] : null;
      }, null);
    });
  }
  function collect(f, xs) {
    return concat(map(f, xs));
  }
  function delay(f) {
    return makeSeq(() => f()[Symbol.iterator]());
  }
  function fold(f, acc, xs) {
    if (Array.isArray(xs) || ArrayBuffer.isView(xs)) {
      return xs.reduce(f, acc);
    } else {
      let cur;
      for (let i = 0, iter = xs[Symbol.iterator]();; i++) {
        cur = iter.next();
        if (cur.done) {
          break;
        }
        acc = f(acc, cur.value, i);
      }
      return acc;
    }
  }
  function iterate(f, xs) {
    fold((_, x) => (f(x), null), null, xs);
  }
  function iterateIndexed(f, xs) {
    fold((_, x, i) => (f(i !== null && i !== void 0 ? i : 0, x), null), null, xs);
  }
  function map(f, xs) {
    return delay(() => unfold(iter => {
      const cur = iter.next();
      return !cur.done ? [f(cur.value), iter] : null;
    }, xs[Symbol.iterator]()));
  }
  function sumBy(f, xs, adder) {
    return fold((acc, x) => adder.Add(acc, f(x)), adder.GetZero(), xs);
  }
  function unfold(f, fst) {
    return makeSeq(() => {
      let acc = fst;
      const iter = {
        next: () => {
          const res = f(acc);
          if (res != null) {
            const v = value(res);
            if (v != null) {
              acc = v[1];
              return {
                done: false,
                value: v[0]
              };
            }
          }
          return {
            done: true,
            value: undefined
          };
        }
      };
      return iter;
    });
  }

  function dateOffsetToString(offset) {
    const isMinus = offset < 0;
    offset = Math.abs(offset);
    const hours = ~~(offset / 3600000);
    const minutes = offset % 3600000 / 60000;
    return (isMinus ? "-" : "+") + padWithZeros(hours, 2) + ":" + padWithZeros(minutes, 2);
  }
  function dateToHalfUTCString(date, half) {
    const str = date.toISOString();
    return half === "first" ? str.substring(0, str.indexOf("T")) : str.substring(str.indexOf("T") + 1, str.length - 1);
  }
  function dateToISOString(d, utc) {
    if (utc) {
      return d.toISOString();
    } else {
      const printOffset = d.kind == null ? true : d.kind === 2
      ;
      return padWithZeros(d.getFullYear(), 4) + "-" + padWithZeros(d.getMonth() + 1, 2) + "-" + padWithZeros(d.getDate(), 2) + "T" + padWithZeros(d.getHours(), 2) + ":" + padWithZeros(d.getMinutes(), 2) + ":" + padWithZeros(d.getSeconds(), 2) + "." + padWithZeros(d.getMilliseconds(), 3) + (printOffset ? dateOffsetToString(d.getTimezoneOffset() * -60000) : "");
    }
  }
  function dateToISOStringWithOffset(dateWithOffset, offset) {
    const str = dateWithOffset.toISOString();
    return str.substring(0, str.length - 1) + dateOffsetToString(offset);
  }
  function dateToStringWithCustomFormat(date, format, utc) {
    return format.replace(/(\w)\1*/g, match => {
      let rep = Number.NaN;
      switch (match.substring(0, 1)) {
        case "y":
          const y = utc ? date.getUTCFullYear() : date.getFullYear();
          rep = match.length < 4 ? y % 100 : y;
          break;
        case "M":
          rep = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
          break;
        case "d":
          rep = utc ? date.getUTCDate() : date.getDate();
          break;
        case "H":
          rep = utc ? date.getUTCHours() : date.getHours();
          break;
        case "h":
          const h = utc ? date.getUTCHours() : date.getHours();
          rep = h > 12 ? h % 12 : h;
          break;
        case "m":
          rep = utc ? date.getUTCMinutes() : date.getMinutes();
          break;
        case "s":
          rep = utc ? date.getUTCSeconds() : date.getSeconds();
          break;
        case "f":
          rep = utc ? date.getUTCMilliseconds() : date.getMilliseconds();
          break;
      }
      if (Number.isNaN(rep)) {
        return match;
      } else {
        return rep < 10 && match.length > 1 ? "0" + rep : "" + rep;
      }
    });
  }
  function dateToStringWithOffset(date, format) {
    var _a, _b, _c;
    const d = new Date(date.getTime() + ((_a = date.offset) !== null && _a !== void 0 ? _a : 0));
    if (typeof format !== "string") {
      return d.toISOString().replace(/\.\d+/, "").replace(/[A-Z]|\.\d+/g, " ") + dateOffsetToString((_b = date.offset) !== null && _b !== void 0 ? _b : 0);
    } else if (format.length === 1) {
      switch (format) {
        case "D":
        case "d":
          return dateToHalfUTCString(d, "first");
        case "T":
        case "t":
          return dateToHalfUTCString(d, "second");
        case "O":
        case "o":
          return dateToISOStringWithOffset(d, (_c = date.offset) !== null && _c !== void 0 ? _c : 0);
        default:
          throw new Error("Unrecognized Date print format");
      }
    } else {
      return dateToStringWithCustomFormat(d, format, true);
    }
  }
  function dateToStringWithKind(date, format) {
    const utc = date.kind === 1
    ;
    if (typeof format !== "string") {
      return utc ? date.toUTCString() : date.toLocaleString();
    } else if (format.length === 1) {
      switch (format) {
        case "D":
        case "d":
          return utc ? dateToHalfUTCString(date, "first") : date.toLocaleDateString();
        case "T":
        case "t":
          return utc ? dateToHalfUTCString(date, "second") : date.toLocaleTimeString();
        case "O":
        case "o":
          return dateToISOString(date, utc);
        default:
          throw new Error("Unrecognized Date print format");
      }
    } else {
      return dateToStringWithCustomFormat(date, format, utc);
    }
  }
  function toString$2(date, format, _provider) {
    return date.offset != null ? dateToStringWithOffset(date, format) : dateToStringWithKind(date, format);
  }

  const formatRegExp = /\{(\d+)(,-?\d+)?(?:\:([a-zA-Z])(\d{0,2})|\:(.+?))?\}/g;
  function isNumeric(x) {
    return typeof x === "number" || x instanceof Long$1 || x instanceof Big;
  }
  function isLessThan(x, y) {
    if (x instanceof Long$1) {
      return compare$2(x, y) < 0;
    } else if (x instanceof Big) {
      return x.cmp(y) < 0;
    } else {
      return x < y;
    }
  }
  function multiply$1(x, y) {
    if (x instanceof Long$1) {
      return op_Multiply(x, y);
    } else if (x instanceof Big) {
      return x.mul(y);
    } else {
      return x * y;
    }
  }
  function toFixed(x, dp) {
    if (x instanceof Long$1) {
      return String(x) + 0 .toFixed(dp).substr(1);
    } else {
      return x.toFixed(dp);
    }
  }
  function toPrecision(x, sd) {
    if (x instanceof Long$1) {
      return String(x) + 0 .toPrecision(sd).substr(1);
    } else {
      return x.toPrecision(sd);
    }
  }
  function toExponential(x, dp) {
    if (x instanceof Long$1) {
      return String(x) + 0 .toExponential(dp).substr(1);
    } else {
      return x.toExponential(dp);
    }
  }
  function toHex(x) {
    if (x instanceof Long$1) {
      return toString$1(x.unsigned ? x : fromBytes$1(toBytes$1(x), true), 16);
    } else {
      return (Number(x) >>> 0).toString(16);
    }
  }
  function format(str, ...args) {
    if (typeof str === "object" && args.length > 0) {
      str = args[0];
      args.shift();
    }
    return str.replace(formatRegExp, (_, idx, padLength, format, precision, pattern) => {
      let rep = args[idx];
      if (isNumeric(rep)) {
        precision = precision == null ? null : parseInt(precision, 10);
        switch (format) {
          case "f":
          case "F":
            precision = precision != null ? precision : 2;
            rep = toFixed(rep, precision);
            break;
          case "g":
          case "G":
            rep = precision != null ? toPrecision(rep, precision) : toPrecision(rep);
            break;
          case "e":
          case "E":
            rep = precision != null ? toExponential(rep, precision) : toExponential(rep);
            break;
          case "p":
          case "P":
            precision = precision != null ? precision : 2;
            rep = toFixed(multiply$1(rep, 100), precision) + " %";
            break;
          case "d":
          case "D":
            rep = precision != null ? padLeft(String(rep), precision, "0") : String(rep);
            break;
          case "x":
          case "X":
            rep = precision != null ? padLeft(toHex(rep), precision, "0") : toHex(rep);
            if (format === "X") {
              rep = rep.toUpperCase();
            }
            break;
          default:
            if (pattern) {
              let sign = "";
              rep = pattern.replace(/(0+)(\.0+)?/, (_, intPart, decimalPart) => {
                if (isLessThan(rep, 0)) {
                  rep = multiply$1(rep, -1);
                  sign = "-";
                }
                rep = toFixed(rep, decimalPart != null ? decimalPart.length - 1 : 0);
                return padLeft(rep, (intPart || "").length - sign.length + (decimalPart != null ? decimalPart.length : 0), "0");
              });
              rep = sign + rep;
            }
        }
      } else if (rep instanceof Date) {
        rep = toString$2(rep, pattern || format);
      }
      padLength = parseInt((padLength || " ").substring(1), 10);
      if (!isNaN(padLength)) {
        rep = padLeft(String(rep), Math.abs(padLength), " ", padLength < 0);
      }
      return rep;
    });
  }
  function join(delimiter, xs) {
    if (Array.isArray(xs)) {
      return xs.join(delimiter);
    } else {
      return Array.from(xs).join(delimiter);
    }
  }
  function padLeft(str, len, ch, isRight) {
    ch = ch || " ";
    len = len - str.length;
    for (let i = 0; i < len; i++) {
      str = isRight ? str + ch : ch + str;
    }
    return str;
  }

  const MutableMap$00602 = declare(function Fable_Collections_MutableMap(pairs, comparer) {
    const $this$$1 = this;
    const this$ = new FSharpRef(null);
    $this$$1.comparer = comparer;
    this$.contents = $this$$1;
    $this$$1.hashMap = new Map([]);
    $this$$1["init@20-1"] = 1;
    iterate(function (pair) {
      MutableMap$00602$$Add$$5BDDA1(this$.contents, pair[0], pair[1]);
    }, pairs);
  });
  function MutableMap$00602$$TryFindIndex$$2B595(this$$$1, k) {
    const h = this$$$1.comparer.GetHashCode(k) | 0;
    const matchValue = tryGetValue(this$$$1.hashMap, h, null);
    if (matchValue[0]) {
      return [true, h, matchValue[1].findIndex(function (pair$$1) {
        return this$$$1.comparer.Equals(k, pair$$1[0]);
      })];
    } else {
      return [false, h, -1];
    }
  }
  function MutableMap$00602$$TryFind$$2B595(this$$$2, k$$1) {
    const matchValue$$1 = MutableMap$00602$$TryFindIndex$$2B595(this$$$2, k$$1);
    var $target$$10;
    if (matchValue$$1[0]) {
      if (matchValue$$1[2] > -1) {
        $target$$10 = 0;
      } else {
        $target$$10 = 1;
      }
    } else {
      $target$$10 = 1;
    }
    switch ($target$$10) {
      case 0:
        {
          return getItemFromDict(this$$$2.hashMap, matchValue$$1[1])[matchValue$$1[2]];
        }
      case 1:
        {
          return null;
        }
    }
  }
  function MutableMap$00602$$Clear(this$$$4) {
    this$$$4.hashMap.clear();
  }
  function MutableMap$00602$$get_Count(this$$$5) {
    const source = this$$$5.hashMap.values();
    return sumBy(function projection(pairs$$2) {
      return pairs$$2.length;
    }, source, {
      GetZero() {
        return 0;
      },
      Add($x$$2, $y$$3) {
        return $x$$2 + $y$$3;
      }
    }) | 0;
  }
  function MutableMap$00602$$get_Item$$2B595(this$$$6, k$$2) {
    const matchValue$$2 = MutableMap$00602$$TryFind$$2B595(this$$$6, k$$2);
    if (matchValue$$2 != null) {
      const pair$$2 = matchValue$$2;
      return pair$$2[1];
    } else {
      throw new Error("The item was not found in collection");
    }
  }
  function MutableMap$00602$$set_Item$$5BDDA1(this$$$7, k$$3, v) {
    const matchValue$$3 = MutableMap$00602$$TryFindIndex$$2B595(this$$$7, k$$3);
    var $target$$20;
    if (matchValue$$3[0]) {
      if (matchValue$$3[2] > -1) {
        $target$$20 = 0;
      } else {
        $target$$20 = 1;
      }
    } else {
      $target$$20 = 1;
    }
    switch ($target$$20) {
      case 0:
        {
          getItemFromDict(this$$$7.hashMap, matchValue$$3[1])[matchValue$$3[2]] = [k$$3, v];
          break;
        }
      case 1:
        {
          if (matchValue$$3[0]) {
            const value = addInPlace([k$$3, v], getItemFromDict(this$$$7.hashMap, matchValue$$3[1]));
          } else {
            this$$$7.hashMap.set(matchValue$$3[1], [[k$$3, v]]);
          }
          break;
        }
    }
  }
  function MutableMap$00602$$Add$$5BDDA1(this$$$8, k$$4, v$$1) {
    const matchValue$$4 = MutableMap$00602$$TryFindIndex$$2B595(this$$$8, k$$4);
    var $target$$24;
    if (matchValue$$4[0]) {
      if (matchValue$$4[2] > -1) {
        $target$$24 = 0;
      } else {
        $target$$24 = 1;
      }
    } else {
      $target$$24 = 1;
    }
    switch ($target$$24) {
      case 0:
        {
          const msg = format("An item with the same key has already been added. Key: {0}", k$$4);
          throw new Error(msg);
        }
      case 1:
        {
          if (matchValue$$4[0]) {
            const value$$1 = addInPlace([k$$4, v$$1], getItemFromDict(this$$$8.hashMap, matchValue$$4[1]));
          } else {
            this$$$8.hashMap.set(matchValue$$4[1], [[k$$4, v$$1]]);
          }
          break;
        }
    }
  }
  function MutableMap$00602$$ContainsKey$$2B595(this$$$9, k$$5) {
    const matchValue$$5 = MutableMap$00602$$TryFindIndex$$2B595(this$$$9, k$$5);
    var $target$$27;
    if (matchValue$$5[0]) {
      if (matchValue$$5[2] > -1) {
        $target$$27 = 0;
      } else {
        $target$$27 = 1;
      }
    } else {
      $target$$27 = 1;
    }
    switch ($target$$27) {
      case 0:
        {
          return true;
        }
      case 1:
        {
          return false;
        }
    }
  }
  function MutableMap$00602$$Remove$$2B595(this$$$10, k$$6) {
    const matchValue$$6 = MutableMap$00602$$TryFindIndex$$2B595(this$$$10, k$$6);
    var $target$$30;
    if (matchValue$$6[0]) {
      if (matchValue$$6[2] > -1) {
        $target$$30 = 0;
      } else {
        $target$$30 = 1;
      }
    } else {
      $target$$30 = 1;
    }
    switch ($target$$30) {
      case 0:
        {
          getItemFromDict(this$$$10.hashMap, matchValue$$6[1]).splice(matchValue$$6[2], 1);
          return true;
        }
      case 1:
        {
          return false;
        }
    }
  }
  MutableMap$00602.prototype[Symbol.iterator] = function () {
    var elems;
    const this$$$11 = this;
    return toIterator((elems = delay(function () {
      return collect(function (pairs$$3) {
        return map(function (pair$$3) {
          return pair$$3;
        }, pairs$$3);
      }, this$$$11.hashMap.values());
    }), getEnumerator(elems)));
  };
  MutableMap$00602.prototype.Add = function (item) {
    const this$$$12 = this;
    MutableMap$00602$$Add$$5BDDA1(this$$$12, item[0], item[1]);
  };
  MutableMap$00602.prototype.Clear = function () {
    const this$$$13 = this;
    MutableMap$00602$$Clear(this$$$13);
  };
  MutableMap$00602.prototype.Contains = function (item$$1) {
    var p;
    const this$$$14 = this;
    const matchValue$$7 = MutableMap$00602$$TryFind$$2B595(this$$$14, item$$1[0]);
    var $target$$31;
    if (matchValue$$7 != null) {
      if (p = matchValue$$7, equals(p[1], item$$1[1])) {
        $target$$31 = 0;
      } else {
        $target$$31 = 1;
      }
    } else {
      $target$$31 = 1;
    }
    switch ($target$$31) {
      case 0:
        {
          return true;
        }
      case 1:
        {
          return false;
        }
    }
  };
  MutableMap$00602.prototype.CopyTo = function (array, arrayIndex) {
    const this$$$15 = this;
    iterateIndexed(function action(i$$10, e) {
      array[arrayIndex + i$$10] = e;
    }, this$$$15);
  };
  Object.defineProperty(MutableMap$00602.prototype, "Count", {
    "get": function () {
      const this$$$16 = this;
      return MutableMap$00602$$get_Count(this$$$16) | 0;
    }
  });
  Object.defineProperty(MutableMap$00602.prototype, "IsReadOnly", {
    "get": function () {
      return false;
    }
  });
  MutableMap$00602.prototype.Remove = function (item$$2) {
    const this$$$18 = this;
    const matchValue$$8 = MutableMap$00602$$TryFind$$2B595(this$$$18, item$$2[0]);
    if (matchValue$$8 != null) {
      const pair$$4 = matchValue$$8;
      if (equals(pair$$4[1], item$$2[1])) {
        const value$$2 = MutableMap$00602$$Remove$$2B595(this$$$18, item$$2[0]);
      }
      return true;
    } else {
      return false;
    }
  };
  Object.defineProperty(MutableMap$00602.prototype, "size", {
    "get": function () {
      const this$$$19 = this;
      return MutableMap$00602$$get_Count(this$$$19) | 0;
    }
  });
  MutableMap$00602.prototype.clear = function () {
    const this$$$20 = this;
    MutableMap$00602$$Clear(this$$$20);
  };
  MutableMap$00602.prototype.delete = function (k$$7) {
    const this$$$21 = this;
    return MutableMap$00602$$Remove$$2B595(this$$$21, k$$7);
  };
  MutableMap$00602.prototype.entries = function () {
    const this$$$22 = this;
    return map(function mapping(x) {
      return x;
    }, this$$$22);
  };
  MutableMap$00602.prototype.get = function (k$$8) {
    const this$$$23 = this;
    return MutableMap$00602$$get_Item$$2B595(this$$$23, k$$8);
  };
  MutableMap$00602.prototype.has = function (k$$9) {
    const this$$$24 = this;
    return MutableMap$00602$$ContainsKey$$2B595(this$$$24, k$$9);
  };
  MutableMap$00602.prototype.keys = function () {
    const this$$$25 = this;
    return map(function mapping$$1(pair$$5) {
      return pair$$5[0];
    }, this$$$25);
  };
  MutableMap$00602.prototype.set = function (k$$10, v$$2) {
    const this$$$26 = this;
    MutableMap$00602$$set_Item$$5BDDA1(this$$$26, k$$10, v$$2);
    return this$$$26;
  };
  MutableMap$00602.prototype.values = function () {
    const this$$$27 = this;
    return map(function mapping$$2(pair$$6) {
      return pair$$6[1];
    }, this$$$27);
  };

  const MapTree$00602 = declare(function Map_MapTree(tag, name, ...fields) {
    Union.call(this, tag, name, ...fields);
  }, Union);
  function MapTreeModule$$$sizeAux($acc$$5, $m$$6) {
    MapTreeModule$$$sizeAux: while (true) {
      const acc = $acc$$5,
            m = $m$$6;
      switch (m.tag) {
        case 1:
          {
            return acc + 1 | 0;
          }
        case 2:
          {
            $acc$$5 = MapTreeModule$$$sizeAux(acc + 1, m.fields[2]);
            $m$$6 = m.fields[3];
            continue MapTreeModule$$$sizeAux;
          }
        default:
          {
            return acc | 0;
          }
      }
    }
  }
  function MapTreeModule$$$size(x) {
    return MapTreeModule$$$sizeAux(0, x);
  }
  function MapTreeModule$$$find($comparer$$1$$23, $k$$3$$24, $m$$4$$25) {
    MapTreeModule$$$find: while (true) {
      const comparer$$1 = $comparer$$1$$23,
            k$$3 = $k$$3$$24,
            m$$4 = $m$$4$$25;
      switch (m$$4.tag) {
        case 1:
          {
            const c$$2 = comparer$$1.Compare(k$$3, m$$4.fields[0]) | 0;
            if (c$$2 === 0) {
              return m$$4.fields[1];
            } else {
              throw new Error("key not found");
            }
          }
        case 2:
          {
            const c$$3 = comparer$$1.Compare(k$$3, m$$4.fields[0]) | 0;
            if (c$$3 < 0) {
              $comparer$$1$$23 = comparer$$1;
              $k$$3$$24 = k$$3;
              $m$$4$$25 = m$$4.fields[2];
              continue MapTreeModule$$$find;
            } else if (c$$3 === 0) {
              return m$$4.fields[1];
            } else {
              $comparer$$1$$23 = comparer$$1;
              $k$$3$$24 = k$$3;
              $m$$4$$25 = m$$4.fields[3];
              continue MapTreeModule$$$find;
            }
          }
        default:
          {
            throw new Error("key not found");
          }
      }
    }
  }
  function MapTreeModule$$$mem($comparer$$10$$59, $k$$12$$60, $m$$8$$61) {
    MapTreeModule$$$mem: while (true) {
      const comparer$$10 = $comparer$$10$$59,
            k$$12 = $k$$12$$60,
            m$$8 = $m$$8$$61;
      switch (m$$8.tag) {
        case 1:
          {
            return comparer$$10.Compare(k$$12, m$$8.fields[0]) === 0;
          }
        case 2:
          {
            const c$$8 = comparer$$10.Compare(k$$12, m$$8.fields[0]) | 0;
            if (c$$8 < 0) {
              $comparer$$10$$59 = comparer$$10;
              $k$$12$$60 = k$$12;
              $m$$8$$61 = m$$8.fields[2];
              continue MapTreeModule$$$mem;
            } else if (c$$8 === 0) {
              return true;
            } else {
              $comparer$$10$$59 = comparer$$10;
              $k$$12$$60 = k$$12;
              $m$$8$$61 = m$$8.fields[3];
              continue MapTreeModule$$$mem;
            }
          }
        default:
          {
            return false;
          }
      }
    }
  }
  const MapTreeModule$002EMapIterator$00602 = declare(function Map_MapTreeModule_MapIterator(arg1, arg2) {
    this.stack = arg1;
    this.started = arg2;
  }, Record);
  function MapTreeModule$$$collapseLHS($stack$$111) {
    MapTreeModule$$$collapseLHS: while (true) {
      const stack = $stack$$111;
      if (stack.tail != null) {
        if (stack.head.tag === 1) {
          return stack;
        } else if (stack.head.tag === 2) {
          $stack$$111 = new List(stack.head.fields[2], new List(new MapTree$00602(1, "MapOne", stack.head.fields[0], stack.head.fields[1]), new List(stack.head.fields[3], stack.tail)));
          continue MapTreeModule$$$collapseLHS;
        } else {
          $stack$$111 = stack.tail;
          continue MapTreeModule$$$collapseLHS;
        }
      } else {
        return new List();
      }
    }
  }
  function MapTreeModule$$$mkIterator(s$$5) {
    return new MapTreeModule$002EMapIterator$00602(MapTreeModule$$$collapseLHS(new List(s$$5, new List())), false);
  }
  function MapTreeModule$$$notStarted() {
    throw new Error("enumeration not started");
  }
  function MapTreeModule$$$alreadyFinished() {
    throw new Error("enumeration already finished");
  }
  function MapTreeModule$$$current(i$$2) {
    if (i$$2.started) {
      const matchValue$$4 = i$$2.stack;
      if (matchValue$$4.tail == null) {
        return MapTreeModule$$$alreadyFinished();
      } else if (matchValue$$4.head.tag === 1) {
        return [matchValue$$4.head.fields[0], matchValue$$4.head.fields[1]];
      } else {
        throw new Error("Please report error: Map iterator, unexpected stack for current");
      }
    } else {
      return MapTreeModule$$$notStarted();
    }
  }
  function MapTreeModule$$$moveNext(i$$3) {
    if (i$$3.started) {
      const matchValue$$5 = i$$3.stack;
      if (matchValue$$5.tail == null) {
        return false;
      } else if (matchValue$$5.head.tag === 1) {
        i$$3.stack = MapTreeModule$$$collapseLHS(matchValue$$5.tail);
        return !(i$$3.stack.tail == null);
      } else {
        throw new Error("Please report error: Map iterator, unexpected stack for moveNext");
      }
    } else {
      i$$3.started = true;
      return !(i$$3.stack.tail == null);
    }
  }
  const MapTreeModule$002EmkIEnumerator$0027$00602 = declare(function Map_MapTreeModule_mkIEnumerator_(s$$6) {
    const $this$$1 = this;
    $this$$1.s = s$$6;
    $this$$1.i = MapTreeModule$$$mkIterator($this$$1.s);
  });
  function MapTreeModule$002EmkIEnumerator$0027$00602$$$$002Ector$$Z26BC498C(s$$6) {
    return this instanceof MapTreeModule$002EmkIEnumerator$0027$00602 ? MapTreeModule$002EmkIEnumerator$0027$00602.call(this, s$$6) : new MapTreeModule$002EmkIEnumerator$0027$00602(s$$6);
  }
  Object.defineProperty(MapTreeModule$002EmkIEnumerator$0027$00602.prototype, "Current", {
    "get": function () {
      const __ = this;
      return MapTreeModule$$$current(__.i);
    }
  });
  MapTreeModule$002EmkIEnumerator$0027$00602.prototype.MoveNext = function () {
    const __$$1 = this;
    return MapTreeModule$$$moveNext(__$$1.i);
  };
  MapTreeModule$002EmkIEnumerator$0027$00602.prototype.Reset = function () {
    const __$$2 = this;
    __$$2.i = MapTreeModule$$$mkIterator(__$$2.s);
  };
  MapTreeModule$002EmkIEnumerator$0027$00602.prototype.Dispose = function () {};
  function MapTreeModule$$$mkIEnumerator(s$$7) {
    return MapTreeModule$002EmkIEnumerator$0027$00602$$$$002Ector$$Z26BC498C(s$$7);
  }
  function MapTreeModule$$$toSeq(s$$8) {
    const en = MapTreeModule$$$mkIEnumerator(s$$8);
    return unfold(function generator(en$$1) {
      if (en$$1.MoveNext()) {
        return [en$$1.Current, en$$1];
      } else {
        return null;
      }
    }, en);
  }
  const FSharpMap = declare(function Map_Map(comparer$$17, tree) {
    const $this$$2 = this;
    $this$$2.comparer = comparer$$17;
    $this$$2.tree = tree;
  });
  function FSharpMap$$get_Tree(__$$5) {
    return __$$5.tree;
  }
  function FSharpMap$$get_Item$$2B595(__$$8, k$$29) {
    return MapTreeModule$$$find(__$$8.comparer, k$$29, __$$8.tree);
  }
  function FSharpMap$$get_Count(__$$20) {
    return MapTreeModule$$$size(__$$20.tree);
  }
  function FSharpMap$$ContainsKey$$2B595(__$$21, k$$31) {
    return MapTreeModule$$$mem(__$$21.comparer, k$$31, __$$21.tree);
  }
  FSharpMap.prototype.toString = function () {
    const this$ = this;
    let str;
    let strings;
    strings = map(function toStr(kv) {
      return format("({0}, {1})", kv[0], kv[1]);
    }, this$);
    str = join("; ", strings);
    return "map [" + str + "]";
  };
  FSharpMap.prototype.GetHashCode = function () {
    const this$$$1 = this;
    const combineHash = function combineHash(x$$16, y$$3) {
      return (x$$16 << 1) + y$$3 + 631;
    };
    let res$$3 = 0;
    const e$$1 = MapTreeModule$$$mkIEnumerator(FSharpMap$$get_Tree(this$$$1));
    while (e$$1.MoveNext()) {
      const patternInput$$5 = e$$1.Current;
      const activePatternResult3692 = patternInput$$5;
      res$$3 = combineHash(res$$3, structuralHash(activePatternResult3692[0]));
      res$$3 = combineHash(res$$3, structuralHash(activePatternResult3692[1]));
    }
    return Math.abs(res$$3) | 0;
  };
  FSharpMap.prototype.Equals = function (that) {
    const this$$$2 = this;
    return this$$$2.CompareTo(that) === 0;
  };
  FSharpMap.prototype[Symbol.iterator] = function () {
    const __$$25 = this;
    return toIterator(MapTreeModule$$$mkIEnumerator(__$$25.tree));
  };
  FSharpMap.prototype.CompareTo = function (obj) {
    const m$$22 = this;
    let res$$4 = 0;
    let finished = false;
    const e1 = MapTreeModule$$$mkIEnumerator(FSharpMap$$get_Tree(m$$22));
    try {
      const e2 = MapTreeModule$$$mkIEnumerator(FSharpMap$$get_Tree(obj));
      try {
        while (!finished ? res$$4 === 0 : false) {
          const matchValue$$7 = [e1.MoveNext(), e2.MoveNext()];
          if (matchValue$$7[0]) {
            if (matchValue$$7[1]) {
              const kvp1 = e1.Current;
              const kvp2 = e2.Current;
              const c$$10 = m$$22.comparer.Compare(kvp1[0], kvp2[0]) | 0;
              res$$4 = c$$10 !== 0 ? c$$10 : compare(kvp1[1], kvp2[1]);
            } else {
              res$$4 = 1;
            }
          } else if (matchValue$$7[1]) {
            res$$4 = -1;
          } else {
            finished = true;
          }
        }
        return res$$4 | 0;
      } finally {
        if (isDisposable(e2)) {
          e2.Dispose();
        }
      }
    } finally {
      if (isDisposable(e1)) {
        e1.Dispose();
      }
    }
  };
  Object.defineProperty(FSharpMap.prototype, "size", {
    "get": function () {
      const this$$$3 = this;
      return FSharpMap$$get_Count(this$$$3) | 0;
    }
  });
  FSharpMap.prototype.clear = function () {
    throw new Error("Map cannot be mutated");
  };
  FSharpMap.prototype.delete = function (_arg1$$1) {
    throw new Error("Map cannot be mutated");
  };
  FSharpMap.prototype.entries = function () {
    const this$$$4 = this;
    return MapTreeModule$$$toSeq(FSharpMap$$get_Tree(this$$$4));
  };
  FSharpMap.prototype.get = function (k$$34) {
    const this$$$5 = this;
    return FSharpMap$$get_Item$$2B595(this$$$5, k$$34);
  };
  FSharpMap.prototype.has = function (k$$35) {
    const this$$$6 = this;
    return FSharpMap$$ContainsKey$$2B595(this$$$6, k$$35);
  };
  FSharpMap.prototype.keys = function () {
    const this$$$7 = this;
    const source$$1 = MapTreeModule$$$toSeq(FSharpMap$$get_Tree(this$$$7));
    return map(function mapping(kv$$1) {
      return kv$$1[0];
    }, source$$1);
  };
  FSharpMap.prototype.set = function (k$$36, v$$26) {
    throw new Error("Map cannot be mutated");
  };
  FSharpMap.prototype.values = function () {
    const this$$$8 = this;
    const source$$2 = MapTreeModule$$$toSeq(FSharpMap$$get_Tree(this$$$8));
    return map(function mapping$$1(kv$$2) {
      return kv$$2[1];
    }, source$$2);
  };

  const MutableSet$00601 = declare(function Fable_Collections_MutableSet(items, comparer) {
    const $this$$1 = this;
    const this$ = new FSharpRef(null);
    $this$$1.comparer = comparer;
    this$.contents = $this$$1;
    $this$$1.hashMap = new Map([]);
    $this$$1["init@21-2"] = 1;
    iterate(function (item) {
      const value = MutableSet$00601$$Add$$2B595(this$.contents, item);
    }, items);
  });
  function MutableSet$00601$$TryFindIndex$$2B595(this$$$1, k) {
    const h = this$$$1.comparer.GetHashCode(k) | 0;
    const matchValue = tryGetValue(this$$$1.hashMap, h, null);
    if (matchValue[0]) {
      return [true, h, matchValue[1].findIndex(function (v) {
        return this$$$1.comparer.Equals(k, v);
      })];
    } else {
      return [false, h, -1];
    }
  }
  function MutableSet$00601$$Clear(this$$$4) {
    this$$$4.hashMap.clear();
  }
  function MutableSet$00601$$get_Count(this$$$5) {
    const source = this$$$5.hashMap.values();
    return sumBy(function projection(pairs) {
      return pairs.length;
    }, source, {
      GetZero() {
        return 0;
      },
      Add($x$$2, $y$$3) {
        return $x$$2 + $y$$3;
      }
    }) | 0;
  }
  function MutableSet$00601$$Add$$2B595(this$$$6, k$$2) {
    const matchValue$$2 = MutableSet$00601$$TryFindIndex$$2B595(this$$$6, k$$2);
    var $target$$16;
    if (matchValue$$2[0]) {
      if (matchValue$$2[2] > -1) {
        $target$$16 = 0;
      } else {
        $target$$16 = 1;
      }
    } else {
      $target$$16 = 1;
    }
    switch ($target$$16) {
      case 0:
        {
          return false;
        }
      case 1:
        {
          if (matchValue$$2[0]) {
            const value$$1 = addInPlace(k$$2, getItemFromDict(this$$$6.hashMap, matchValue$$2[1]));
            return true;
          } else {
            this$$$6.hashMap.set(matchValue$$2[1], [k$$2]);
            return true;
          }
        }
    }
  }
  function MutableSet$00601$$Contains$$2B595(this$$$7, k$$3) {
    const matchValue$$3 = MutableSet$00601$$TryFindIndex$$2B595(this$$$7, k$$3);
    var $target$$19;
    if (matchValue$$3[0]) {
      if (matchValue$$3[2] > -1) {
        $target$$19 = 0;
      } else {
        $target$$19 = 1;
      }
    } else {
      $target$$19 = 1;
    }
    switch ($target$$19) {
      case 0:
        {
          return true;
        }
      case 1:
        {
          return false;
        }
    }
  }
  function MutableSet$00601$$Remove$$2B595(this$$$8, k$$4) {
    const matchValue$$4 = MutableSet$00601$$TryFindIndex$$2B595(this$$$8, k$$4);
    var $target$$22;
    if (matchValue$$4[0]) {
      if (matchValue$$4[2] > -1) {
        $target$$22 = 0;
      } else {
        $target$$22 = 1;
      }
    } else {
      $target$$22 = 1;
    }
    switch ($target$$22) {
      case 0:
        {
          getItemFromDict(this$$$8.hashMap, matchValue$$4[1]).splice(matchValue$$4[2], 1);
          return true;
        }
      case 1:
        {
          return false;
        }
    }
  }
  MutableSet$00601.prototype[Symbol.iterator] = function () {
    var elems;
    const this$$$9 = this;
    return toIterator((elems = delay(function () {
      return collect(function (values$$1) {
        return map(function (value$$2) {
          return value$$2;
        }, values$$1);
      }, this$$$9.hashMap.values());
    }), getEnumerator(elems)));
  };
  MutableSet$00601.prototype.Add = function (item$$1) {
    const this$$$10 = this;
    const value$$3 = MutableSet$00601$$Add$$2B595(this$$$10, item$$1);
  };
  MutableSet$00601.prototype.Clear = function () {
    const this$$$11 = this;
    MutableSet$00601$$Clear(this$$$11);
  };
  MutableSet$00601.prototype.Contains = function (item$$2) {
    const this$$$12 = this;
    return MutableSet$00601$$Contains$$2B595(this$$$12, item$$2);
  };
  MutableSet$00601.prototype.CopyTo = function (array, arrayIndex) {
    const this$$$13 = this;
    iterateIndexed(function action(i$$8, e) {
      array[arrayIndex + i$$8] = e;
    }, this$$$13);
  };
  Object.defineProperty(MutableSet$00601.prototype, "Count", {
    "get": function () {
      const this$$$14 = this;
      return MutableSet$00601$$get_Count(this$$$14) | 0;
    }
  });
  Object.defineProperty(MutableSet$00601.prototype, "IsReadOnly", {
    "get": function () {
      return false;
    }
  });
  MutableSet$00601.prototype.Remove = function (item$$3) {
    const this$$$16 = this;
    return MutableSet$00601$$Remove$$2B595(this$$$16, item$$3);
  };
  Object.defineProperty(MutableSet$00601.prototype, "size", {
    "get": function () {
      const this$$$17 = this;
      return MutableSet$00601$$get_Count(this$$$17) | 0;
    }
  });
  MutableSet$00601.prototype.add = function (k$$5) {
    const this$$$18 = this;
    const value$$4 = MutableSet$00601$$Add$$2B595(this$$$18, k$$5);
    return this$$$18;
  };
  MutableSet$00601.prototype.add_ = function (k$$6) {
    const this$$$19 = this;
    return MutableSet$00601$$Add$$2B595(this$$$19, k$$6);
  };
  MutableSet$00601.prototype.clear = function () {
    const this$$$20 = this;
    MutableSet$00601$$Clear(this$$$20);
  };
  MutableSet$00601.prototype.delete = function (k$$7) {
    const this$$$21 = this;
    return MutableSet$00601$$Remove$$2B595(this$$$21, k$$7);
  };
  MutableSet$00601.prototype.has = function (k$$8) {
    const this$$$22 = this;
    return MutableSet$00601$$Contains$$2B595(this$$$22, k$$8);
  };
  MutableSet$00601.prototype.keys = function () {
    const this$$$23 = this;
    return map(function mapping(x) {
      return x;
    }, this$$$23);
  };
  MutableSet$00601.prototype.values = function () {
    const this$$$24 = this;
    return map(function mapping$$1(x$$1) {
      return x$$1;
    }, this$$$24);
  };
  MutableSet$00601.prototype.entries = function () {
    const this$$$25 = this;
    return map(function mapping$$2(v$$1) {
      return [v$$1, v$$1];
    }, this$$$25);
  };

  const SetTree$00601 = declare(function Set_SetTree(tag, name, ...fields) {
    Union.call(this, tag, name, ...fields);
  }, Union);
  function SetTreeModule$$$SetOne(n) {
    return new SetTree$00601(2, "SetOne", n);
  }
  function SetTreeModule$$$SetNode(x, l$$1, r$$1, h) {
    return new SetTree$00601(1, "SetNode", x, l$$1, r$$1, h);
  }
  const SetTreeModule$002ESetIterator$00601 = declare(function Set_SetTreeModule_SetIterator(arg1, arg2) {
    this.stack = arg1;
    this.started = arg2;
  }, Record);
  function SetTreeModule$$$collapseLHS($stack$$104) {
    SetTreeModule$$$collapseLHS: while (true) {
      const stack = $stack$$104;
      if (stack.tail != null) {
        if (stack.head.tag === 2) {
          return stack;
        } else if (stack.head.tag === 1) {
          $stack$$104 = new List(stack.head.fields[1], new List(SetTreeModule$$$SetOne(stack.head.fields[0]), new List(stack.head.fields[2], stack.tail)));
          continue SetTreeModule$$$collapseLHS;
        } else {
          $stack$$104 = stack.tail;
          continue SetTreeModule$$$collapseLHS;
        }
      } else {
        return new List();
      }
    }
  }
  function SetTreeModule$$$mkIterator(s$$13) {
    return new SetTreeModule$002ESetIterator$00601(SetTreeModule$$$collapseLHS(new List(s$$13, new List())), false);
  }
  function SetTreeModule$$$notStarted() {
    throw new Error("Enumeration not started");
  }
  function SetTreeModule$$$alreadyFinished() {
    throw new Error("Enumeration already started");
  }
  function SetTreeModule$$$current(i) {
    if (i.started) {
      const matchValue$$6 = i.stack;
      if (matchValue$$6.tail == null) {
        return SetTreeModule$$$alreadyFinished();
      } else if (matchValue$$6.head.tag === 2) {
        return matchValue$$6.head.fields[0];
      } else {
        throw new Error("Please report error: Set iterator, unexpected stack for current");
      }
    } else {
      return SetTreeModule$$$notStarted();
    }
  }
  function SetTreeModule$$$moveNext(i$$1) {
    if (i$$1.started) {
      const matchValue$$7 = i$$1.stack;
      if (matchValue$$7.tail == null) {
        return false;
      } else if (matchValue$$7.head.tag === 2) {
        i$$1.stack = SetTreeModule$$$collapseLHS(matchValue$$7.tail);
        return !(i$$1.stack.tail == null);
      } else {
        throw new Error("Please report error: Set iterator, unexpected stack for moveNext");
      }
    } else {
      i$$1.started = true;
      return !(i$$1.stack.tail == null);
    }
  }
  const SetTreeModule$002EmkIEnumerator$00601 = declare(function Set_SetTreeModule_mkIEnumerator(s$$14) {
    const $this$$1 = this;
    $this$$1.s = s$$14;
    $this$$1.i = SetTreeModule$$$mkIterator($this$$1.s);
  });
  function SetTreeModule$002EmkIEnumerator$00601$$$$002Ector$$Z5B395D56(s$$14) {
    return this instanceof SetTreeModule$002EmkIEnumerator$00601 ? SetTreeModule$002EmkIEnumerator$00601.call(this, s$$14) : new SetTreeModule$002EmkIEnumerator$00601(s$$14);
  }
  Object.defineProperty(SetTreeModule$002EmkIEnumerator$00601.prototype, "Current", {
    "get": function () {
      const __ = this;
      return SetTreeModule$$$current(__.i);
    }
  });
  SetTreeModule$002EmkIEnumerator$00601.prototype.MoveNext = function () {
    const __$$1 = this;
    return SetTreeModule$$$moveNext(__$$1.i);
  };
  SetTreeModule$002EmkIEnumerator$00601.prototype.Reset = function () {
    const __$$2 = this;
    __$$2.i = SetTreeModule$$$mkIterator(__$$2.s);
  };
  SetTreeModule$002EmkIEnumerator$00601.prototype.Dispose = function () {};
  function SetTreeModule$$$mkIEnumerator(s$$15) {
    return SetTreeModule$002EmkIEnumerator$00601$$$$002Ector$$Z5B395D56(s$$15);
  }
  function SetTreeModule$$$compareStacks($comparer$$17$$112, $l1$$113, $l2$$114) {
    SetTreeModule$$$compareStacks: while (true) {
      const comparer$$17 = $comparer$$17$$112,
            l1 = $l1$$113,
            l2 = $l2$$114;
      var $target$$115, t1$$6, t2$$6, n1k, n2k, t1$$7, t2$$7, n1k$$1, n2k$$1, n2r, t1$$8, t2$$8, emp, n1k$$2, n1r, n2k$$2, t1$$9, t2$$9, n1k$$3, n1r$$1, n2k$$3, n2r$$1, t1$$10, t2$$10, n1k$$4, t1$$11, n1k$$5, n1l, n1r$$2, t1$$12, n2k$$4, t2$$11, n2k$$5, n2l, n2r$$2, t2$$12;
      if (l1.tail != null) {
        if (l2.tail != null) {
          if (l2.head.tag === 2) {
            if (l1.head.tag === 2) {
              $target$$115 = 4;
              n1k = l1.head.fields[0];
              n2k = l2.head.fields[0];
              t1$$7 = l1.tail;
              t2$$7 = l2.tail;
            } else if (l1.head.tag === 1) {
              if (l1.head.fields[1].tag === 0) {
                $target$$115 = 6;
                emp = l1.head.fields[1];
                n1k$$2 = l1.head.fields[0];
                n1r = l1.head.fields[2];
                n2k$$2 = l2.head.fields[0];
                t1$$9 = l1.tail;
                t2$$9 = l2.tail;
              } else {
                $target$$115 = 9;
                n1k$$5 = l1.head.fields[0];
                n1l = l1.head.fields[1];
                n1r$$2 = l1.head.fields[2];
                t1$$12 = l1.tail;
              }
            } else {
              $target$$115 = 10;
              n2k$$4 = l2.head.fields[0];
              t2$$11 = l2.tail;
            }
          } else if (l2.head.tag === 1) {
            if (l2.head.fields[1].tag === 0) {
              if (l1.head.tag === 2) {
                $target$$115 = 5;
                n1k$$1 = l1.head.fields[0];
                n2k$$1 = l2.head.fields[0];
                n2r = l2.head.fields[2];
                t1$$8 = l1.tail;
                t2$$8 = l2.tail;
              } else if (l1.head.tag === 1) {
                if (l1.head.fields[1].tag === 0) {
                  $target$$115 = 7;
                  n1k$$3 = l1.head.fields[0];
                  n1r$$1 = l1.head.fields[2];
                  n2k$$3 = l2.head.fields[0];
                  n2r$$1 = l2.head.fields[2];
                  t1$$10 = l1.tail;
                  t2$$10 = l2.tail;
                } else {
                  $target$$115 = 9;
                  n1k$$5 = l1.head.fields[0];
                  n1l = l1.head.fields[1];
                  n1r$$2 = l1.head.fields[2];
                  t1$$12 = l1.tail;
                }
              } else {
                $target$$115 = 11;
                n2k$$5 = l2.head.fields[0];
                n2l = l2.head.fields[1];
                n2r$$2 = l2.head.fields[2];
                t2$$12 = l2.tail;
              }
            } else if (l1.head.tag === 2) {
              $target$$115 = 8;
              n1k$$4 = l1.head.fields[0];
              t1$$11 = l1.tail;
            } else if (l1.head.tag === 1) {
              $target$$115 = 9;
              n1k$$5 = l1.head.fields[0];
              n1l = l1.head.fields[1];
              n1r$$2 = l1.head.fields[2];
              t1$$12 = l1.tail;
            } else {
              $target$$115 = 11;
              n2k$$5 = l2.head.fields[0];
              n2l = l2.head.fields[1];
              n2r$$2 = l2.head.fields[2];
              t2$$12 = l2.tail;
            }
          } else if (l1.head.tag === 2) {
            $target$$115 = 8;
            n1k$$4 = l1.head.fields[0];
            t1$$11 = l1.tail;
          } else if (l1.head.tag === 1) {
            $target$$115 = 9;
            n1k$$5 = l1.head.fields[0];
            n1l = l1.head.fields[1];
            n1r$$2 = l1.head.fields[2];
            t1$$12 = l1.tail;
          } else {
            $target$$115 = 3;
            t1$$6 = l1.tail;
            t2$$6 = l2.tail;
          }
        } else {
          $target$$115 = 2;
        }
      } else if (l2.tail != null) {
        $target$$115 = 1;
      } else {
        $target$$115 = 0;
      }
      switch ($target$$115) {
        case 0:
          {
            return 0;
          }
        case 1:
          {
            return -1 | 0;
          }
        case 2:
          {
            return 1;
          }
        case 3:
          {
            $comparer$$17$$112 = comparer$$17;
            $l1$$113 = t1$$6;
            $l2$$114 = t2$$6;
            continue SetTreeModule$$$compareStacks;
          }
        case 4:
          {
            const c$$7 = comparer$$17.Compare(n1k, n2k) | 0;
            if (c$$7 !== 0) {
              return c$$7 | 0;
            } else {
              $comparer$$17$$112 = comparer$$17;
              $l1$$113 = t1$$7;
              $l2$$114 = t2$$7;
              continue SetTreeModule$$$compareStacks;
            }
          }
        case 5:
          {
            const c$$8 = comparer$$17.Compare(n1k$$1, n2k$$1) | 0;
            if (c$$8 !== 0) {
              return c$$8 | 0;
            } else {
              $comparer$$17$$112 = comparer$$17;
              $l1$$113 = new List(new SetTree$00601(0, "SetEmpty"), t1$$8);
              $l2$$114 = new List(n2r, t2$$8);
              continue SetTreeModule$$$compareStacks;
            }
          }
        case 6:
          {
            const c$$9 = comparer$$17.Compare(n1k$$2, n2k$$2) | 0;
            if (c$$9 !== 0) {
              return c$$9 | 0;
            } else {
              $comparer$$17$$112 = comparer$$17;
              $l1$$113 = new List(n1r, t1$$9);
              $l2$$114 = new List(emp, t2$$9);
              continue SetTreeModule$$$compareStacks;
            }
          }
        case 7:
          {
            const c$$10 = comparer$$17.Compare(n1k$$3, n2k$$3) | 0;
            if (c$$10 !== 0) {
              return c$$10 | 0;
            } else {
              $comparer$$17$$112 = comparer$$17;
              $l1$$113 = new List(n1r$$1, t1$$10);
              $l2$$114 = new List(n2r$$1, t2$$10);
              continue SetTreeModule$$$compareStacks;
            }
          }
        case 8:
          {
            $comparer$$17$$112 = comparer$$17;
            $l1$$113 = new List(new SetTree$00601(0, "SetEmpty"), new List(SetTreeModule$$$SetOne(n1k$$4), t1$$11));
            $l2$$114 = l2;
            continue SetTreeModule$$$compareStacks;
          }
        case 9:
          {
            $comparer$$17$$112 = comparer$$17;
            $l1$$113 = new List(n1l, new List(SetTreeModule$$$SetNode(n1k$$5, new SetTree$00601(0, "SetEmpty"), n1r$$2, 0), t1$$12));
            $l2$$114 = l2;
            continue SetTreeModule$$$compareStacks;
          }
        case 10:
          {
            $comparer$$17$$112 = comparer$$17;
            $l1$$113 = l1;
            $l2$$114 = new List(new SetTree$00601(0, "SetEmpty"), new List(SetTreeModule$$$SetOne(n2k$$4), t2$$11));
            continue SetTreeModule$$$compareStacks;
          }
        case 11:
          {
            $comparer$$17$$112 = comparer$$17;
            $l1$$113 = l1;
            $l2$$114 = new List(n2l, new List(SetTreeModule$$$SetNode(n2k$$5, new SetTree$00601(0, "SetEmpty"), n2r$$2, 0), t2$$12));
            continue SetTreeModule$$$compareStacks;
          }
      }
      break;
    }
  }
  function SetTreeModule$$$compare(comparer$$18, s1, s2) {
    if (s1.tag === 0) {
      if (s2.tag === 0) {
        return 0;
      } else {
        return -1 | 0;
      }
    } else if (s2.tag === 0) {
      return 1;
    } else {
      return SetTreeModule$$$compareStacks(comparer$$18, new List(s1, new List()), new List(s2, new List())) | 0;
    }
  }
  const FSharpSet = declare(function Set_Set(comparer$$22, tree) {
    const $this$$2 = this;
    $this$$2.comparer = comparer$$22;
    $this$$2.tree = tree;
  });
  function FSharpSet$$get_Comparer(__$$4) {
    return __$$4.comparer;
  }
  function FSharpSet$$get_Tree(__$$5) {
    return __$$5.tree;
  }
  FSharpSet.prototype.toString = function () {
    var strings;
    const this$ = this;
    return "set [" + (strings = map(function (x$$21) {
      let copyOfStruct = x$$21;
      return String(copyOfStruct);
    }, this$), join("; ", strings)) + "]";
  };
  FSharpSet.prototype.GetHashCode = function () {
    const this$$$1 = this;
    let res = 0;
    const e$$1 = SetTreeModule$$$mkIEnumerator(FSharpSet$$get_Tree(this$$$1));
    while (e$$1.MoveNext()) {
      const x$$22 = res | 0;
      const y$$4 = structuralHash(e$$1.Current) | 0;
      res = (x$$22 << 1) + y$$4 + 631;
    }
    return Math.abs(res) | 0;
  };
  FSharpSet.prototype.Equals = function (that) {
    const this$$$2 = this;
    return SetTreeModule$$$compare(FSharpSet$$get_Comparer(this$$$2), FSharpSet$$get_Tree(this$$$2), FSharpSet$$get_Tree(that)) === 0;
  };
  FSharpSet.prototype.CompareTo = function (that$$1) {
    const this$$$3 = this;
    return SetTreeModule$$$compare(FSharpSet$$get_Comparer(this$$$3), FSharpSet$$get_Tree(this$$$3), FSharpSet$$get_Tree(that$$1)) | 0;
  };
  FSharpSet.prototype[Symbol.iterator] = function () {
    const s$$32 = this;
    return toIterator(SetTreeModule$$$mkIEnumerator(FSharpSet$$get_Tree(s$$32)));
  };

  function initialize(count$$8, initializer, cons$$15) {
    if (count$$8 < 0) {
      throw new Error("The input must be non-negative\\nParameter name: count");
    }
    const result$$7 = new cons$$15(count$$8);
    for (let i$$13 = 0; i$$13 <= count$$8 - 1; i$$13++) {
      result$$7[i$$13] = initializer(i$$13);
    }
    return result$$7;
  }
  function addInPlace(x$$3, array$$47) {
    const value$$7 = array$$47.push(x$$3);
  }
  function sort(xs$$2, comparer$$2) {
    const xs$$3 = xs$$2.slice();
    xs$$3.sort(function comparer$$3(x$$13, y$$3) {
      return comparer$$2.Compare(x$$13, y$$3);
    });
    return xs$$3;
  }
  function sum(array$$120, adder) {
    let acc$$11 = adder.GetZero();
    for (let i$$44 = 0; i$$44 <= array$$120.length - 1; i$$44++) {
      acc$$11 = adder.Add(acc$$11, array$$120[i$$44]);
    }
    return acc$$11;
  }

  const rng = {};
  function sortNumbers() {
    let value;
    let array$$1;
    const array = initialize(3000000, function (_arg1) {
      return Math.random() * 1000000;
    }, Float64Array);
    array$$1 = sort(array, {
      Compare: comparePrimitives
    });
    value = sum(array$$1, {
      GetZero() {
        return 0;
      },
      Add($x$$3, $y$$4) {
        return $x$$3 + $y$$4;
      }
    });
    return ~~value | 0;
  }

  exports.rng = rng;
  exports.sortNumbers = sortNumbers;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
