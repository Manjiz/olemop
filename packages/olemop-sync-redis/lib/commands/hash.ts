/**
 * Module dependencies.
 */

/**
 * HLEN <key>
 */
export const hlen = (key) => {
  const obj = this.lookup(key)
  return obj && obj.type === 'hash' ? Object.keys(obj.val).length : -1
}

/**
 * HVALS <key>
 */
export const hvals = (key) => {
  const obj = this.lookup(key)
  return obj && obj.type === 'hash' ? obj.val : null
}

/**
 * HKEYS <key>
 */
export const hkeys = (key) => {
  const obj = this.lookup(key)
  return obj && obj.type === 'hash' ? Object.keys(obj.val) : null
}

/**
 * HSET <key> <field> <val>
 */
export const hset = (key, field, val) => {
  let obj = this.lookup(key)
  if (obj && obj.type !== 'hash') return false
  if (!obj) {
    obj = this.db.data[key] = { type: 'hash', val: {} }
  }
  obj.val[field] = val
  return true
}
// hset.mutates = true

/**
 * HMSET <key> (<field> <val>)+
 */
export const hmset = (data) => {
  const key = data[0]
  let obj = this.lookup(key)
  if (obj && obj.type !== 'hash') return false
  if (!obj) {
    obj = this.db.data[key] = { type: 'hash', val: {} }
  }
  for (let i = 1; i < data.length; ++i) {
    const field = data[i++]
    const val = data[i]
    obj.val[field] = val
  }
  return true
}
// hmset.mutates = true
// hmset.multiple = 2
// hmset.skip = 1

/**
 * HGET <key> <field>
 */
export const hget = (key, field) => {
  const obj = this.lookup(key)
  if (!obj || obj.type !== 'hash' || !obj.val[field]) return null
  return obj.val[field]
}

/**
 * HGETALL <key>
 */
export const hgetall = (key) => {
  const obj = this.lookup(key)
  if (!obj || obj.type !== 'hash') return null
  const list = []
  Object.keys(obj.val).forEach((key) => {
    list.push(key, obj.val[key])
  })
  return list
}

/**
 * HEXISTS <key> <field>
 */
export const hexists = (key, field) => {
  const obj = this.lookup(key)
  if (!obj || obj.type !== 'hash') return false
  return field in obj.val
}
