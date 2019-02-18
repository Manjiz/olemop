const util = require('util')
const EventEmitter = require('events')
const logger = require('@olemop/logger').getLogger('olemop-rpc', 'MailStation')
const defaultMailboxFactory = require('./mailbox')
const constants = require('../util/constants')
const utils = require('../util/utils')

// station has inited
const STATE_INITED = 1
// station has started
const STATE_STARTED = 2
// station has closed
const STATE_CLOSED = 3

/**
 * Do before or after filter
 */
const doFilter = (tracer, err, serverId, msg, opts, filters, index, operate, cb) => {
  if (index < filters.length) {
    tracer && tracer.info('client', __filename, 'doFilter', `do ${operate} filter ${filters[index].name}`)
  }

  if (err || index >= filters.length) {
    cb(tracer, err, serverId, msg, opts)
    return
  }

  const filter = filters[index]

  if (typeof filter === 'function') {
    filter(serverId, msg, opts, (target, message, options) => {
      index++
      // compatible for olemop filter next(err) method
      if (utils.getObjectClass(target) === 'Error') {
        doFilter(tracer, target, serverId, msg, opts, filters, index, operate, cb)
      } else {
        doFilter(tracer, null, target || serverId, message || msg, options || opts, filters, index, operate, cb)
      }
    })
    return
  }

  if (typeof filter[operate] === 'function') {
    filter[operate](serverId, msg, opts, (target, message, options) => {
      index++
      if (utils.getObjectClass(target) === 'Error') {
        doFilter(tracer, target, serverId, msg, opts, filters, index, operate, cb)
      } else {
        doFilter(tracer, null, target || serverId, message || msg, options || opts, filters, index, operate, cb)
      }
    })
    return
  }

  index++
  doFilter(tracer, err, serverId, msg, opts, filters, index, operate, cb)
}

const lazyConnect = (tracer, station, serverId, factory, cb) => {
  tracer && tracer.info('client', __filename, 'lazyConnect', 'create mailbox and try to connect to remote server')
  const server = station.servers[serverId]
  const online = station.onlines[serverId]
  if (!server) {
    logger.error(`[olemop-rpc] unknown server: ${serverId}`)
    return false
  }
  if (!online || online !== 1) {
    logger.error(`[olemop-rpc] server is not online: ${serverId}`)
    return false
  }
  const mailbox = factory.create(server, station.opts)
  station.connecting[serverId] = true
  station.mailboxes[serverId] = mailbox
  station.connect(tracer, serverId, cb)
  return true
}

const addToPending = (tracer, station, serverId, args) => {
  tracer && tracer.info('client', __filename, 'addToPending', 'add pending requests to pending queue')
  let pending = station.pendings[serverId]
  if (!pending) {
    pending = station.pendings[serverId] = []
  }
  if (pending.length > station.pendingSize) {
    tracer && tracer.debug('client', __filename, 'addToPending', `station pending too much for: ${serverId}`)
    logger.warn(`[olemop-rpc] station pending too much for: ${serverId}`)
    return
  }
  pending.push(args)
}

const flushPending = (tracer, station, serverId, cb) => {
  tracer && tracer.info('client', __filename, 'flushPending', 'flush pending requests to dispatch method')
  const pending = station.pendings[serverId]
  const mailbox = station.mailboxes[serverId]

  if (!pending || !pending.length) return

  if (!mailbox) {
    tracer && tracer.error('client', __filename, 'flushPending', `fail to flush pending messages for empty mailbox: ${serverId}`)
    logger.error(`[olemop-rpc] fail to flush pending messages for empty mailbox: ${serverId}`)
  }
  pending.forEach((item) => {
    station.dispatch.apply(station, item)
  })
  delete station.pendings[serverId]
}

const errorHandler = (tracer, station, err, serverId, msg, opts, flag, cb) => {
  if (station.handleError) {
    station.handleError(err, serverId, msg, opts)
  } else {
    logger.error(`[olemop-rpc] rpc filter error with serverId: ${serverId}, err: ${err.stack}`)
    station.emit('error', constants.RPC_ERROR.FILTER_ERROR, tracer, serverId, msg, opts)
  }
}

/**
 * Mail station constructor.
 *
 * @param {Object} opts construct parameters
 */
const MailStation = function (opts) {
  EventEmitter.call(this)
  this.opts = opts

  // remote server info map, key: server id, value: info
  this.servers = {}

  // remote server info map, key: serverType, value: servers array
  this.serversMap = {}

  // remote server online map, key: server id, value: 0/offline 1/online
  this.onlines = {}

  this.mailboxFactory = opts.mailboxFactory || defaultMailboxFactory

  // filters
  this.befores = []
  this.afters = []

  // pending request queues
  this.pendings = {}
  this.pendingSize = opts.pendingSize || constants.DEFAULT_PARAM.DEFAULT_PENDING_SIZE

  // connecting remote server mailbox map
  this.connecting = {}

  // working mailbox map
  this.mailboxes = {}

  this.state = STATE_INITED
}

util.inherits(MailStation, EventEmitter)

/**
 * Init and start station. Connect all mailbox to remote servers.
 *
 * @param  {Function} cb(err) callback function
 * @returns {Void}
 */
MailStation.prototype.start = function (cb) {
  if (this.state > STATE_INITED) {
    cb(new Error('station has started.'))
    return
  }

  process.nextTick(() => {
    this.state = STATE_STARTED
    cb()
  })
}

/**
 * Stop station and all its mailboxes
 *
 * @param  {Boolean} force whether stop station forcely
 * @returns {Void}
 */
MailStation.prototype.stop = function (force) {
  if (this.state !== STATE_STARTED) {
    logger.warn('[olemop-rpc] client is not running now.')
    return
  }
  this.state = STATE_CLOSED

  const closeAll = () => {
    for (let id in this.mailboxes) {
      this.mailboxes[id].close()
    }
  }
  if (force) {
    closeAll()
  } else {
    setTimeout(closeAll, constants.DEFAULT_PARAM.GRACE_TIMEOUT)
  }
}

/**
 * Add a new server info into the mail station and clear
 * the blackhole associated with the server id if any before.
 *
 * @param {Object} serverInfo server info such as {id, host, port}
 */
MailStation.prototype.addServer = function (serverInfo) {
  if (!serverInfo || !serverInfo.id) return

  const id = serverInfo.id
  const type = serverInfo.serverType
  this.servers[id] = serverInfo
  this.onlines[id] = 1

  if (!this.serversMap[type]) {
    this.serversMap[type] = []
  }

  if (this.serversMap[type].indexOf(id) < 0) {
    this.serversMap[type].push(id)
  }
  this.emit('addServer', id)
}

/**
 * Batch version for add new server info.
 *
 * @param {Array} serverInfos server info list
 */
MailStation.prototype.addServers = function (serverInfos) {
  if (!serverInfos || !serverInfos.length) return

  serverInfos.forEach((item) => {
    this.addServer(item)
  })
}

/**
 * Remove a server info from the mail station and remove
 * the mailbox instance associated with the server id.
 *
 * @param  {String|Number} id server id
 */
MailStation.prototype.removeServer = function (id) {
  this.onlines[id] = 0
  const mailbox = this.mailboxes[id]
  if (mailbox) {
    mailbox.close()
    delete this.mailboxes[id]
  }
  this.emit('removeServer', id)
}

/**
 * Batch version for remove remote servers.
 *
 * @param  {Array} ids server id list
 */
MailStation.prototype.removeServers = function (ids) {
  if (!ids || !ids.length) return

  ids.forEach((item) => {
    this.removeServer(item)
  })
}

/**
 * Clear station infomation.
 *
 */
MailStation.prototype.clearStation = function () {
  this.onlines = {}
  this.serversMap = {}
}

/**
 * Replace remote servers info.
 *
 * @param {Array} serverInfos server info list
 */
MailStation.prototype.replaceServers = function (serverInfos) {
  this.clearStation()
  if (!serverInfos || !serverInfos.length) return

  serverInfos.forEach((item) => {
    const id = item.id
    const type = item.serverType
    this.onlines[id] = 1
    if (!this.serversMap[type]) {
      this.serversMap[type] = []
    }
    this.servers[id] = item
    if (this.serversMap[type].indexOf(id) < 0) {
      this.serversMap[type].push(id)
    }
  })
}

/**
 * Dispatch rpc message to the mailbox
 *
 * @param  {Object}   tracer   rpc debug tracer
 * @param {string}   serverId remote server id
 * @param  {Object}   msg      rpc invoke message
 * @param  {Object}   opts     rpc invoke option args
 * @param  {Function} cb       callback function
 * @returns {Void}
 */
MailStation.prototype.dispatch = function (tracer, serverId, msg, opts, cb) {
  tracer && tracer.info('client', __filename, 'dispatch', 'dispatch rpc message to the mailbox')
  tracer && (tracer.cb = cb)
  if (this.state !== STATE_STARTED) {
    tracer && tracer.error('client', __filename, 'dispatch', 'client is not running now')
    logger.error('[olemop-rpc] client is not running now.')
    this.emit('error', constants.RPC_ERROR.SERVER_NOT_STARTED, tracer, serverId, msg, opts)
    return
  }

  const mailbox = this.mailboxes[serverId]
  if (!mailbox) {
    tracer && tracer.debug('client', __filename, 'dispatch', 'mailbox is not exist')
    // try to connect remote server if mailbox instance not exist yet
    if (!lazyConnect(tracer, this, serverId, this.mailboxFactory, cb)) {
      tracer && tracer.error('client', __filename, 'dispatch', `fail to find remote server: ${serverId}`)
      logger.error(`[olemop-rpc] fail to find remote server: ${serverId}`)
      this.emit('error', constants.RPC_ERROR.NO_TRAGET_SERVER, tracer, serverId, msg, opts)
    }
    // push request to the pending queue
    addToPending(tracer, this, serverId, arguments)
    return
  }

  if (this.connecting[serverId]) {
    tracer && tracer.debug('client', __filename, 'dispatch', 'request add to connecting')
    // if the mailbox is connecting to remote server
    addToPending(tracer, this, serverId, arguments)
    return
  }

  const send = (tracer, err, serverId, msg, opts) => {
    tracer && tracer.info('client', __filename, 'send', 'get corresponding mailbox and try to send message')
    const tmpMailbox = this.mailboxes[serverId]
    if (err) {
      return errorHandler(tracer, this, err, serverId, msg, opts, true, cb)
    }
    if (!tmpMailbox) {
      tracer && tracer.error('client', __filename, 'send', `can not find mailbox with id: ${serverId}`)
      logger.error(`[olemop-rpc] could not find mailbox with id: ${serverId}`)
      this.emit('error', constants.RPC_ERROR.FAIL_FIND_MAILBOX, tracer, serverId, msg, opts)
      return
    }
    tmpMailbox.send(tracer, msg, opts, (tracer_send, send_err, args) => {
      // const tracer_send = args[0]
      // const send_err = args[1]
      if (send_err) {
        logger.error(`[olemop-rpc] fail to send message ${send_err.stack || send_err.message}`)
        this.emit('error', constants.RPC_ERROR.FAIL_SEND_MESSAGE, tracer, serverId, msg, opts)
        cb && cb(send_err)
        // utils.applyCallback(cb, send_err)
        return
      }
      // const args = args[2]
      doFilter(tracer_send, null, serverId, msg, opts, this.afters, 0, 'after', (tracer, err, serverId, msg, opts) => {
        if (err) {
          errorHandler(tracer, this, err, serverId, msg, opts, false, cb)
        }
        utils.applyCallback(cb, args)
      })
    })
  }

  doFilter(tracer, null, serverId, msg, opts, this.befores, 0, 'before', send)
}

/**
 * Add a before filter
 *
 * @param  {[type]} filter [description]
 * @returns {[type]}        [description]
 */
MailStation.prototype.before = function (filter) {
  if (Array.isArray(filter)) {
    this.befores = this.befores.concat(filter)
    return
  }
  this.befores.push(filter)
}

/**
 * Add after filter
 *
 * @param  {[type]} filter [description]
 * @returns {[type]}        [description]
 */
MailStation.prototype.after = function (filter) {
  if (Array.isArray(filter)) {
    this.afters = this.afters.concat(filter)
    return
  }
  this.afters.push(filter)
}

/**
 * Add before and after filter
 *
 * @param  {[type]} filter [description]
 * @returns {[type]}        [description]
 */
MailStation.prototype.filter = function (filter) {
  this.befores.push(filter)
  this.afters.push(filter)
}

/**
 * Try to connect to remote server
 *
 * @param  {Object}   tracer   rpc debug tracer
 * @returns {string}   serverId remote server id
 * @param  {Function}   cb     callback function
 */
MailStation.prototype.connect = function (tracer, serverId, cb) {
  const mailbox = this.mailboxes[serverId]
  mailbox.connect(tracer, (err) => {
    if (err) {
      tracer && tracer.error('client', __filename, 'lazyConnect', `fail to connect to remote server: ${serverId}`)
      logger.error(`[olemop-rpc] mailbox fail to connect to remote server: ${serverId}`)
      if (this.mailboxes[serverId]) {
        delete this.mailboxes[serverId]
      }
      this.emit('error', constants.RPC_ERROR.FAIL_CONNECT_SERVER, tracer, serverId, null, this.opts)
      return
    }
    mailbox.on('close', (id) => {
      const mbox = this.mailboxes[id]
      if (mbox) {
        mbox.close()
        delete this.mailboxes[id]
      }
      this.emit('close', id)
    })
    delete this.connecting[serverId]
    flushPending(tracer, this, serverId)
  })
}

/**
 * Mail station factory function.
 *
 * @param  {Object} opts construct paramters
 *           opts.servers {Object} global server info map. {serverType: [{id, host, port, ...}, ...]}
 *           opts.mailboxFactory {Function} mailbox factory function
 * @returns {Object}      mail station instance
 */
const create = function (opts = {}) {
  return new MailStation(opts)
}

module.exports = {
  create
}
