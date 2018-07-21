const olemopUtils = require('@olemop/utils')
const logger = require('pomelo-logger').getLogger('olemop-rpc', 'rpc-proxy')

/**
 * Generate prxoy for function type field
 *
 * @param namespace {String} current namespace
 * @param serverType {String} server type string
 * @param serviceName {String} delegated service name
 * @param methodName {String} delegated method name
 * @param origin {Object} origin object
 * @param proxyCB {Functoin} proxy callback function
 * @returns function proxy
 */
const genFunctionProxy = function (serviceName, methodName, origin, attach, proxyCB) {
  return (function () {
    const proxy = function () {
      const len = arguments.length
      const args = new Array(len)
      for (let i = 0; i < len; i++) {
        args[i] = arguments[i]
      }
      proxyCB(serviceName, methodName, args, attach)
    }

    proxy.toServer = function () {
      const len = arguments.length
      const args = new Array(len)
      for (let i = 0; i < len; i++) {
        args[i] = arguments[i]
      }
      proxyCB(serviceName, methodName, args, attach, true)
    }

    return proxy
  })()
}

const genObjectProxy = function (serviceName, origin, attach, proxyCB) {
  //generate proxy for function field
  const res = {}
  olemopUtils.listES6ClassMethods(origin).forEach(function (field) {
    if (typeof origin[field] === 'function') {
      res[field] = genFunctionProxy(serviceName, field, origin, attach, proxyCB);
    }
  })
  return res
}

/**
 * Create proxy.
 *
 * @param  {Object} opts construct parameters
 *           opts.origin {Object} delegated object
 *           opts.proxyCB {Function} proxy invoke callback
 *           opts.service {String} deletgated service name
 *           opts.attach {Object} attach parameter pass to proxyCB
 * @return {Object}      proxy instance
 */
exports.create = function (opts) {
  if (!opts || !opts.origin) {
    logger.warn('opts and opts.origin should not be empty.')
    return null
  }

  if (!opts.proxyCB || typeof opts.proxyCB !== 'function') {
    logger.warn('opts.proxyCB is not a function, return the origin module directly.')
    return opts.origin
  }

  return genObjectProxy(opts.service, opts.origin, opts.attach, opts.proxyCB)
}
