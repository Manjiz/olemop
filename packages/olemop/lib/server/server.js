/**
 * Implementation of server component.
 * Init and start server instance.
 */

const fs = require('fs')
const path = require('path')
const Loader = require('@olemop/loader')
const schedule = require('@olemop/scheduler')
const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const pathUtil = require('../util/pathUtil')
const events = require('../util/events')
const Constants = require('../util/constants')
const FilterService = require('../common/service/filterService')
const HandlerService = require('../common/service/handlerService')

// server inited
const ST_INITED = 0
// server started
const ST_STARTED = 1
// server stoped
const ST_STOPED = 2

/**
 * Server factory function.
 *
 * @param {Object} app  current application context
 * @returns {Object} erver instance
 */
module.exports.create = (app, opts) => {
  return new Server(app, opts)
}

class Server {
  constructor (app, opts = {}) {
    this.opts = opts
    this.app = app
    this.globalFilterService = null
    this.filterService = null
    this.handlerService = null
    this.crons = []
    this.jobs = {}
    this.state = ST_INITED

    app.event.on(events.ADD_CRONS, this.addCrons.bind(this))
    app.event.on(events.REMOVE_CRONS, this.removeCrons.bind(this))
  }

  /**
   * Server lifecycle callback
   */
  start () {
    if (this.state > ST_INITED) return

    this.globalFilterService = initFilter(true, this.app)
    this.filterService = initFilter(false, this.app)
    this.handlerService = initHandler(this.app, this.opts)
    this.cronHandlers = loadCronHandlers(this.app)
    loadCrons(this, this.app)
    this.state = ST_STARTED
  }

  afterStart () {
    scheduleCrons(this, this.crons)
  }

  /**
   * Stop server
   */
  stop () {
    this.state = ST_STOPED
  }

  /**
   * Global handler.
   *
   * @param  {Object} msg request message
   * @param  {Object} session session object
   * @param  {Callback} callback function
   */
  globalHandle (msg, session, cb) {
    if (this.state !== ST_STARTED) {
      olemopUtils.invokeCallback(cb, new Error('server not started'))
      return
    }

    const routeRecord = parseRoute(msg.route)
    if (!routeRecord) {
      olemopUtils.invokeCallback(cb, new Error('meet unknown route message %j', msg.route))
      return
    }

    const dispatch = (err, resp, opts) => {
      if (err) {
        handleError(true, this, err, msg, session, resp, opts, (err, resp, opts) => {
          response(true, this, err, msg, session, resp, opts, cb)
        })
        return
      }

      if (this.app.getServerType() !== routeRecord.serverType) {
        doForward(this.app, msg, session, routeRecord, (err, resp, opts) => {
          response(true, this, err, msg, session, resp, opts, cb)
        })
      } else {
        doHandle(this, msg, session, routeRecord, (err, resp, opts) => {
          response(true, this, err, msg, session, resp, opts, cb)
        })
      }
    }
    beforeFilter(true, this, msg, session, dispatch)
  }

  /**
   * Handle request
   */
  handle (msg, session, cb) {
    if (this.state !== ST_STARTED) {
      cb(new Error('server not started'))
      return
    }

    const routeRecord = parseRoute(msg.route)
    doHandle(this, msg, session, routeRecord, cb)
  }

  /**
   * Add crons at runtime.
   *
   * @param {Array} crons would be added in application
   */
  addCrons (crons) {
    this.cronHandlers = loadCronHandlers(this.app)
    crons.forEach((cron) => {
      checkAndAdd(cron, this.crons, this)
    })
    scheduleCrons(this, crons)
  }

  /**
   * Remove crons at runtime.
   *
   * @param {Array} crons would be removed in application
   */
  removeCrons (crons) {
    crons.forEach((cron) => {
      const id = parseInt(cron.id)
      if (this.jobs[id]) {
        schedule.cancelJob(this.jobs[id])
      } else {
        logger.warn('cron is not in application: %j', cron)
      }
    })
    crons.forEach((cron) => {
      const id = parseInt(cron.id)
      if (this.jobs[id]) {
        schedule.cancelJob(this.jobs[id])
      } else {
        logger.warn('cron is not in application: %j', cron)
      }
    })
  }
}

const initFilter = (isGlobal, app) => {
  const service = new FilterService()
  let befores
  let afters

  if (isGlobal) {
    befores = app.get(Constants.KEYWORDS.GLOBAL_BEFORE_FILTER)
    afters = app.get(Constants.KEYWORDS.GLOBAL_AFTER_FILTER)
  } else {
    befores = app.get(Constants.KEYWORDS.BEFORE_FILTER)
    afters = app.get(Constants.KEYWORDS.AFTER_FILTER)
  }

  if (befores) {
    befores.forEach((item) => {
      service.before(item)
    })
  }

  if (afters) {
    afters.forEach((item) => {
      service.after(item)
    })
  }

  return service
}

const initHandler = (app, opts) => {
  return new HandlerService(app, opts)
}

/**
 * Load cron handlers from current application
 */
const loadCronHandlers = (app) => {
  const p = pathUtil.getCronPath(app.getBase(), app.getServerType())
  if (p) {
    return Loader.load(p, app)
  }
}

/**
 * Load crons from configure file
 */
const loadCrons = (server, app) => {
  const env = app.get(Constants.RESERVED.ENV)
  let p = path.join(app.getBase(), Constants.FILEPATH.CRON)
  if (!fs.existsSync(p)) {
    p = path.join(app.getBase(), Constants.FILEPATH.CONFIG_DIR, env, path.basename(Constants.FILEPATH.CRON))
    if (!fs.existsSync(p)) return
  }
  app.loadConfigBaseApp(Constants.RESERVED.CRONS, Constants.FILEPATH.CRON)
  const crons = app.get(Constants.RESERVED.CRONS)
  for (let serverType in crons) {
    if (app.serverType === serverType) {
      const list = crons[serverType]
      list.forEach((item) => {
        if (!item.serverId) {
          checkAndAdd(item, server.crons, server)
        } else if (app.serverId === item.serverId) {
          checkAndAdd(item, server.crons, server)
        }
      })
    }
  }
}

/**
 * Fire before filter chain if any
 */
const beforeFilter = (isGlobal, server, msg, session, cb) => {
  const fm = isGlobal ? server.globalFilterService : server.filterService
  if (fm) {
    fm.beforeFilter(msg, session, cb)
  } else {
    olemopUtils.invokeCallback(cb)
  }
}

/**
 * Fire after filter chain if have
 */
const afterFilter = (isGlobal, server, err, msg, session, resp, opts, cb) => {
  const fm = isGlobal ? server.globalFilterService : server.filterService
  if (!fm) return
  if (isGlobal) {
    fm.afterFilter(err, msg, session, resp, () => {
      // do nothing
    })
  } else {
    fm.afterFilter(err, msg, session, resp, (err) => {
      cb(err, resp, opts)
    })
  }
}

/**
 * pass err to the global error handler if specified
 */
const handleError = (isGlobal, server, err, msg, session, resp, opts, cb) => {
  const handler = isGlobal ? server.app.get(Constants.RESERVED.GLOBAL_ERROR_HANDLER) : server.app.get(Constants.RESERVED.ERROR_HANDLER)
  if (!handler) {
    logger.debug(`no default error handler to resolve unknown exception. ${err.stack}`)
    olemopUtils.invokeCallback(cb, err, resp, opts)
  } else {
    if (handler.length === 5) {
      handler(err, msg, resp, session, cb)
    } else {
      handler(err, msg, resp, session, opts, cb)
    }
  }
}

/**
 * Send response to client and fire after filter chain if any.
 */
const response = (isGlobal, server, err, msg, session, resp, opts, cb) => {
  if (isGlobal) {
    cb(err, resp, opts)
    // after filter should not interfere response
    afterFilter(isGlobal, server, err, msg, session, resp, opts, cb)
  } else {
    afterFilter(isGlobal, server, err, msg, session, resp, opts, cb)
  }
}

/**
 * Parse route string.
 *
 * @param {string} route route string, such as: serverName.handlerName.methodName
 * @returns {Object}       parse result object or null for illeagle route string
 */
const parseRoute = (route) => {
  if (!route) {
    return null
  }
  const ts = route.split('.')
  if (ts.length !== 3) {
    return null
  }

  return {
    route,
    serverType: ts[0],
    handler: ts[1],
    method: ts[2]
  }
}

const doForward = (app, msg, session, routeRecord, cb) => {
  let finished = false
  // should route to other servers
  try {
    app.sysrpc[routeRecord.serverType].msgRemote.forwardMessage(
      // app.sysrpc[routeRecord.serverType].msgRemote.forwardMessage2(
      session,
      msg,
      // msg.oldRoute || msg.route,
      // msg.body,
      // msg.aesPassword,
      // msg.compressGzip,
      session.export(),
      (err, resp, opts) => {
        if (err) {
          logger.error(`fail to process remote message: ${err.stack}`)
        }
        finished = true
        olemopUtils.invokeCallback(cb, err, resp, opts)
      }
    )
  } catch (err) {
    if (!finished) {
      logger.error(`fail to forward message: ${err.stack}`)
      olemopUtils.invokeCallback(cb, err)
    }
  }
}

const doHandle = (server, msg, session, routeRecord, cb) => {
  const originMsg = msg
  msg = msg.body || {}
  msg.__route__ = originMsg.route

  const self = server

  beforeFilter(false, server, msg, session, (err, resp, opts) => {
    if (err) {
      // error from before filter
      handleError(false, self, err, msg, session, resp, opts, (err, resp, opts) => {
        response(false, self, err, msg, session, resp, opts, cb)
      })
      return
    }

    self.handlerService.handle(routeRecord, msg, session, (err, resp, opts) => {
      if (err) {
        // error from handler
        handleError(false, self, err, msg, session, resp, opts, (err, resp, opts) => {
          response(false, self, err, msg, session, resp, opts, cb)
        })
        return
      }

      response(false, self, err, msg, session, resp, opts, cb)
    })
  })
}

/**
 * Schedule crons
 */
const scheduleCrons = (server, crons) => {
  const handlers = server.cronHandlers
  for (let i = 0; i < crons.length; i++) {
    const cronInfo = crons[i]
    const time = cronInfo.time
    const action = cronInfo.action
    const jobId = cronInfo.id

    if (!time || !action || !jobId) {
      logger.error('cron miss necessary parameters: %j', cronInfo)
      continue
    }

    if (action.indexOf('.') < 0) {
      logger.error('cron action is error format: %j', cronInfo)
      continue
    }

    const [cron, job] = action.split('.')
    const handler = handlers[cron]

    if (!handler) {
      logger.error('could not find cron: %j', cronInfo)
      continue
    }

    if (typeof handler[job] !== 'function') {
      logger.error('could not find cron job: %j, %s', cronInfo, job)
      continue
    }

    const id = schedule.scheduleJob(time, handler[job].bind(handler))
    server.jobs[jobId] = id
  }
}

/**
 * If cron is not in crons then put it in the array.
 */
const checkAndAdd = (cron, crons, server) => {
  if (!containCron(cron.id, crons)) {
    server.crons.push(cron)
  } else {
    logger.warn('cron is duplicated: %j', cron)
  }
}

/**
 * Check if cron is in crons.
 */
const containCron = (id, crons) => {
  for (let i = 0; i < crons.length; i++) {
    if (id === crons[i].id) {
      return true
    }
  }
  return false
}
