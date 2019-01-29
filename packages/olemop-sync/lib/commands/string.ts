/**
 * GET <key> set value
 */
export const get = (key: string) => {
  const obj = this.lookup(key)
  return obj ? obj.val : null
}

/**
 * GETSET <key> <val>
 */
export const getset = (key: string, val: string) => {
  this.writeToAOF('getset', [ key, val ])
  this.db.data[key] = { val }
  return this.get(key)
}

/**
 * SET db value by key
 */
export const set = (key: string, val: object) => {
  this.writeToAOF('set', [ key, val ])
  this.db.data[key] = { val }
  return true
}
// set.mutates = true

/**
 * INCR <key> counter
 */
export const incr = (key: string) => {
  const obj = this.lookup(key)
  if (!obj) {
    this.db.data[key] = {val: 1 }
    return 1
  } else {
    return ++obj.val
  }
}
// incr.mutates = true

/**
 * INCRBY <key>  counter with step <num>
 * @param {string} key
 * @param {number} num
 */
export const incrby = (key: string, num: number) => {
  let obj = this.lookup(key)
  if (isNaN(num)) { throw new Error('TypeError') }
  if (!obj) {
    obj = this.db.data[key] = { val: num }
    return obj.val
  } else {
    return (obj.val += num)
  }
}
// incrby.mutates = true

/**
 * DECRBY <key> <num>
 */
export const decrby = (key, num) => {
  let obj = this.lookup(key)
  if (isNaN(num)) { throw new Error('TypoeError') }
  if (!obj) {
    obj = this.db.data[key] = { val: -num }
    return obj.val
  } else {
    obj.val = obj.val - num
    return obj.val
  }
}
// decrby.mutates = true

/**
 * DECR <key>
 */
export const decr = (key) => {
  const obj = this.lookup(key)
  if (!obj) {
    this.db.data[key] = { val: -1 }
    return -1;
  } else {
    return --obj.val
  }
}
// decr.mutates = true

/**
 * STRLEN <key>
 */
export const strlen = (key): number => {
  const val = this.lookup(key)
  return val ? val.length : 0
}

/**
 * MGET <key>+
 */
export const mget = (keys: string[]): object[] => keys.map((key) => this.lookup(key))
// mget.multiple = 1

/**
 * MSET (<key> <val>)+
 */
export const mset = (strs) => {
  for (let i = 0; i < strs.length; ++i) {
    const key = strs[i++]
    this.db.data[key] = { val: strs[i] }
  }
  return true
}
// exports.mset.multiple = 2
// exports.mset.mutates = true

