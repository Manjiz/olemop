module.exports = {
  isSimpleType: (type) => ['uInt32', 'sInt32', 'int32', 'uInt64', 'sInt64', 'float', 'double'].includes(type),

  equal (obj0, obj1) {
    for (let key in obj0) {
      const m = obj0[key]
      const n = obj1[key]
      if (typeof(m) === 'object') {
        if (!this.equal(m, n)) {
          return false
        }
      } else if (m !== n) {
        return false
      }
    }
    return true
  }
}
