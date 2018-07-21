/**
 * 列出ES6的一个Class实例上的所有方法，但不包括父类的
 * @param objInstance
 */
exports.listES6ClassMethods = function (objInstance) {
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
