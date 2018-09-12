/**
 * 列出ES6的一个Class实例上的所有方法，但不包括父类的
 * @param objInstance
 */
exports.listES6ClassMethods = (objInstance) => {
  if (objInstance.prototype && objInstance.prototype.constructor === objInstance) {
    const names = []
    const methodNames = Object.getOwnPropertyNames(objInstance.prototype)
    for (let name of methodNames) {
      const method = objInstance.prototype[name]
      // Supposedly you'd like to skip constructor
      if (!(method instanceof Function) || name === 'constructor') continue
      names.push(name)
    }
    return names
  } else {
    const names = []
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(objInstance)).concat(Object.getOwnPropertyNames(objInstance))
    for (let name of methodNames) {
      const method = objInstance[name]
      // Supposedly you'd like to skip constructor
      if (!(method instanceof Function) || name === 'constructor') continue
      names.push(name)
    }
    return names
  }
}

/**
 * Invoke callback with check
 * @param {Function} cb 准回调函数
 */
exports.invokeCallback = (cb) => {
  cb && typeof cb === 'function' && cb.apply(null, Array.prototype.slice.call(arguments, 1))
}

/**
 * 统计一个对象里属性（非方法）的个数
 * @param {Object} obj
 */
exports.size = (obj) => {
  let count = 0
  for (let key in obj) {
    obj.hasOwnProperty(key) && typeof obj[key] !== 'function' && count++
  }
  return count
}
