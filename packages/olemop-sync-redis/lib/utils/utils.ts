import util from 'util'

/**
 * Convert object to a string.
 */
const string = (o: object): string => {
  try {
    return JSON.stringify(o)
  } catch (err) {
    return util.inspect(o, true, 100, true)
  }
}

/**
 * Parse a `pattern` and return a RegExp.
 */
const parsePattern = (pattern: string): RegExp => {
  pattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${pattern}$`)
}

/**
 * invoke callback function
 * @param cb
 */
const invoke = function (cb) {
  cb && typeof cb === 'function' && cb.apply(null, Array.prototype.slice.call(arguments, 1))
}

/***
 * clone new object
 */
const clone = (obj: object | any[]): object => {
  if (obj !== Object(obj)) return null
  if (obj instanceof Array) return obj.slice()
  return Object.assign({}, obj)
}

/**
 *return the merge length
 */
const getMapLength = (map: object): number => Object.keys(map).length

export default {
  string,
  parsePattern,
  invoke,
  clone,
  getMapLength
}
