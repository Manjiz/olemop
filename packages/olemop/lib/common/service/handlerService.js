const fs = require('fs')
const Loader = require('@olemop/loader')
const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const forwardLogger = require('@olemop/logger').getLogger('forward-log', __filename)
const utils = require('../../util/utils')
const pathUtil = require('../../util/pathUtil')

/**
 * Load handlers from current application
 */
const _loadHandlers = (app, serverType, handlerMap) => {
  const p = pathUtil.getHandlerPath(app.getBase(), serverType)
  if (p) {
    handlerMap[serverType] = Loader.load(p, app)
  }
}

const _watchHandlers = (app, handlerMap) => {
  const p = pathUtil.getHandlerPath(app.getBase(), app.serverType)
  if (p) {
    fs.watch(p, (event, name) => {
      if (event === 'change') {
        handlerMap[app.serverType] = Loader.load(p, app)
      }
    })
  }
}

const _getResp = (args) => {
  const len = args.length
  switch (len) {
    case 1:
      return []
    case 2:
      return [args[1]]
    case 3:
      return [args[1], args[2]]
    case 4:
      return [args[1], args[2], args[3]]
    default:
      const r = new Array(len)
      for (let i = 1; i < len; i++) {
        r[i] = args[i]
      }
      return r
  }
}

/**
 * Handler service.
 * Dispatch request to the relactive handler.
 *
 * @param {Object} app      current application context
 */
class HandlerService {
  constructor (app, opts) {
    this.name = 'handler'
    this.app = app
    this.handlerMap = {}
    if (opts.reloadHandlers) {
      _watchHandlers(app, this.handlerMap)
    }

    this.enableForwardLog = opts.enableForwardLog || false
  }

  /**
   * Handler the request.
   */
  async handle (routeRecord, msg, session, cb) {
    // the request should be processed by current server
    const handler = this.getHandler(routeRecord)
    if (!handler) {
      logger.error(`[handleManager]: fail to find handler for ${msg.__route__}`)
      olemopUtils.invokeCallback(cb, new Error(`fail to find handler for ${msg.__route__}`))
      return
    }
    const start = Date.now()

    const callback = (err, resp, opts) => {
      if (this.enableForwardLog) {
        forwardLogger.info(JSON.stringify({
          route: msg.__route__,
          args: msg,
          time: utils.format(new Date(start)),
          timeUsed: new Date() - start
        }))
      }

      // resp = _getResp(arguments) 小心 arguments
      olemopUtils.invokeCallback(cb, err, resp, opts)
    }

    const method = routeRecord.method

    if (!Array.isArray(msg)) {
      try {
        await handler[method](msg, session, callback)
      } catch (err) {
        olemopUtils.invokeCallback(cb, err, null, null)
      }
    } else {
      msg.push(session)
      msg.push(callback)
      handler[method].apply(handler, msg)
    }
  }

  /**
   * Get handler instance by routeRecord.
   *
   * @param  {Object} handlers    handler map
   * @param  {Object} routeRecord route record parsed from route string
   * @returns {Object}             handler instance if any matchs or null for match fail
   */
  getHandler (routeRecord) {
    const serverType = routeRecord.serverType
    if (!this.handlerMap[serverType]) {
      _loadHandlers(this.app, serverType, this.handlerMap)
    }
    const handlers = this.handlerMap[serverType] || {}
    const handler = handlers[routeRecord.handler]
    if (!handler) {
      logger.warn('could not find handler for routeRecord: %j', routeRecord)
      return null
    }
    if (typeof handler[routeRecord.method] !== 'function') {
      logger.warn(`could not find the method ${routeRecord.method} in handler: ${routeRecord.handler}`)
      return null
    }
    return handler
  }
}

module.exports = HandlerService
