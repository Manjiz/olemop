const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop-rpc', 'rpc-proxy')

/**
 * Generate prxoy for function type field
 *
 * @param namespace {string} current namespace
 * @param serverType {string} server type string
 * @param serviceName {string} delegated service name
 * @param methodName {string} delegated method name
 * @param origin {Object} origin object
 * @param proxyCB {Functoin} proxy callback function
 * @returns function proxy
 */
const genFunctionProxy = (serviceName, methodName, origin, attach, proxyCB) => {
  const proxy = (...args) => {
    proxyCB(serviceName, methodName, args, attach)
  }

  proxy.toServer = (...args) => {
    proxyCB(serviceName, methodName, args, attach, true)
  }

  return proxy
}

const genObjectProxy = (serviceName, origin, attach, proxyCB) => {
  // generate proxy for function field
  const res = {}
  olemopUtils.listES6ClassMethods(origin).forEach((field) => {
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
 *           opts.service {string} deletgated service name
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
