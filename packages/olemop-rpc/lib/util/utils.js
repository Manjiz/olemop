const Utils = {}

/**
 * @param {Function} cb
 * @param {*} ... cb parameters
 */
Utils.invokeCallback = (...args) => {
  const cb = args[0]
  const params = args.slice(1)
	if (typeof cb === 'function') {
		cb.apply(null, params)
	}
}

Utils.applyCallback = (cb, args) => {
	if (typeof cb === 'function') {
		cb.apply(null, args)
	}
}

Utils.getObjectClass = (obj) => {
	if (!obj) return

	const constructor = obj.constructor
	if (!constructor) return

	if (constructor.name) {
		return constructor.name
	}

	const str = constructor.toString()
	if (!str) return

	const arr = str.charAt(0) == '[' ? str.match(/\[\w+\s*(\w+)\]/) : str.match(/function\s*(\w+)/)

	if (arr && arr.length == 2) {
		return arr[1]
	}
}

/**
 * Utils check float
 *
 * @param  {Float}   float
 * @returns {boolean}
 */
Utils.checkFloat = (v) => {
	return v === Number(v) && v % 1 !== 0
	// return parseInt(v) !== v
}

/**
 * Utils check type
 *
 * @param {string}   type
 * @returns {Function} high order function
 */
Utils.isType = (type) => {
	return (obj) => {
		return {}.toString.call(obj) === `[object ${type}]`
	}
}

Utils.checkArray = Array.isArray || Utils.isType('Array')
Utils.checkNumber = Utils.isType('Number')
Utils.checkFunction = Utils.isType('Function')
Utils.checkObject = Utils.isType('Object')
Utils.checkString = Utils.isType('String')
Utils.checkBoolean = Utils.isType('Boolean')

/**
 * Utils check bean
 *
 * @param  {Object}   obj object
 * @returns {boolean}
 */
Utils.checkBean = (obj) => {
  return obj && obj['$id']
    && Utils.checkFunction(obj['writeFields'])
    && Utils.checkFunction(obj['readFields'])
}

Utils.checkNull = (obj) => !Utils.isNotNull(obj)

/**
 * Utils check is not null
 *
 * @param  {Object}   value
 * @returns {boolean}
 */
Utils.isNotNull = (value) => value !== null && typeof value !== 'undefined'

Utils.getType = (object) => {
	if (object == null || typeof object === 'undefined') {
		return Utils.typeMap['null']
	}

	if (Buffer.isBuffer(object)) {
		return Utils.typeMap['buffer']
	}

	if (Utils.checkArray(object)) {
		return Utils.typeMap['array']
	}

	if (Utils.checkString(object)) {
		return Utils.typeMap['string']
	}

	if (Utils.checkObject(object)) {
		if (Utils.checkBean(object)) {
			return Utils.typeMap['bean']
		} else {
      return Utils.typeMap['object']
    }
	}

	if (Utils.checkBoolean(object)) {
		return Utils.typeMap['boolean']
	}

	if (Utils.checkNumber(object)) {
		if (Utils.checkFloat(object)) {
			return Utils.typeMap['float']
		} else if (isNaN(object)) {
			return Utils.typeMap['null']
		} else {
      return Utils.typeMap['number']
    }
	}
}

const typeArray = ['', 'null', 'buffer', 'array', 'string', 'object', 'bean', 'boolean', 'float', 'number']
const typeMap = typeArray.reduce((prev, item, index) => {
  if (index !== 0) {
    prev[item] = index
  }
  return prev
}, {})

Utils.typeArray = typeArray

Utils.typeMap = typeMap

Utils.getBearcat = () => require('bearcat')

Utils.genServicesMap = (services) => {
  // namespace
  const nMap = {}
  // service
  const sMap = {}
  // method
	const mMap = {}
	const nList = []
	const sList = []
	const mList = []

  Object.keys(services).forEach((namespace, nIndex) => {
    nList.push(namespace)
		nMap[namespace] = nIndex
    const s = services[namespace]

    Object.keys(s).forEach((service, sIndex) => {
      sList.push(service)
			sMap[service] = sIndex
      const m = s[service]

      Object.keys(m).forEach((method, mIndex) => {
        const func = m[method]
				if (Utils.checkFunction(func)) {
					mList.push(method)
					mMap[method] = mIndex
				}
      })
    })
  })

	return [nMap, sMap, mMap, nList, sList, mList]
}

module.exports = Utils
