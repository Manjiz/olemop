import utils from '../utils/utils'

/**
 * EXPIRE <key> <seconds>
 */
export const expire = (key, seconds) => {
  let obj = this.lookup(key)
  if (!obj) return false
  obj.expires = Date.now() + (seconds * 1000)
  return true
}

/**
 * EXPIREAT <key> <seconds>
 */
export const expireat = (key, seconds) => {
  let obj = this.lookup(key)
  if (!obj) return false
  obj.expires = +seconds * 1000
  return true
}

export const del = (key) => {
  if (!this.lookup(key)) return false
  delete this.db.data[key]
  return true
}
// del.mutates = true

/**
 * PERSIST <key>
 */
export const persist = (key) => {
  const obj = this.lookup(key)
  if (!obj || typeof obj.expires !== 'number') return false
  delete obj.expires
  return true
}

/**
 * TTL <key>
 */
export const ttl = (key) => {
  const obj = this.lookup(key)
  return obj && typeof obj.expires === 'number' ? Math.round((obj.expires - Date.now()) / 1000) : 0
}

/**
 * TYPE <key>
 */
export const type = (key) => {
  const obj = this.lookup(key)
  return obj && obj.type
}

/**
 * EXISTS <key>
 */
export const exists = (key) => this.lookup(key)

/**
 * RANDOMKEY
 */
export const randomkey = () => {
  const keys = Object.keys(this.db.data)
  const len = keys.length
  if (!len) return null
  return keys[Math.random() * len | 0]
}

/**
 * RENAME <from> <to>
 */
export const rename = (from, to) => {
  const data = this.db.data
  if (from === to)  { throw Error('source and destination objects are the same') }

  // Fail if attempting to rename a non-existant key
  if (!this.lookup(from)) { throw Error('no such key') }

  // Map key val / key type
  const type = data[from].type
  const obj = data[to] = data[from]
  obj.type = type
  delete data[from]
  return true
}
// rename.mutates = true

/**
 * KEYS <pattern>
 */
export const keys = (pattern) => {
  const keys = Object.keys(this.db.data)

  // Optimize for common "*"
  if (pattern === '*') return  keys

  // Convert pattern to regexp
  pattern = utils.parsePattern(pattern)

  // Filter
  return keys.filter((key) => pattern.test(key))
}
