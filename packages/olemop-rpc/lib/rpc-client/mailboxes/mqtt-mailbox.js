/**
 * Message Queuing Telemetry Transport (MQTT)
 */

const net = require('net')
const util = require('util')
const EventEmitter = require('events')
const MqttCon = require('mqtt-connection')
const logger = require('@olemop/logger').getLogger('olemop-rpc', 'mqtt-mailbox')
const Constants = require('../../util/constants')
const Tracer = require('../../util/tracer')

const CONNECT_TIMEOUT = 2000

const enqueue = (mailbox, msg) => {
  mailbox.queue.push(msg)
}

const doSend = (socket, msg) => {
  socket.publish({
    topic: 'rpc',
    payload: JSON.stringify(msg)
  })
}

const flush = (mailbox) => {
  if (mailbox.closed || !mailbox.queue.length) {
    return
  }
  doSend(mailbox.socket, mailbox.queue)
  mailbox.queue = []
}

const upgradeHandshake = (mailbox, msg) => {
  mailbox.servicesMap = JSON.parse(msg.toString())
}

const processMsg = (mailbox, pkg) => {
  clearCbTimeout(mailbox, pkg.id)
  const cb = mailbox.requests[pkg.id]

  if (!cb) return

  delete mailbox.requests[pkg.id]
  const rpcDebugLog = mailbox.opts.rpcDebugLog
  let tracer = null
  const sendErr = null
  if (rpcDebugLog) {
    tracer = new Tracer(mailbox.opts.rpcLogger, mailbox.opts.rpcDebugLog, mailbox.opts.clientId, pkg.source, pkg.resp, pkg.traceId, pkg.seqId)
  }

  cb(tracer, sendErr, pkg.resp)
}

const processMsgs = (mailbox, pkgs) => {
  pkgs.forEach((item) => {
    processMsg(mailbox, item)
  })
}

const setCbTimeout = (mailbox, id, tracer, cb) => {
  const timer = setTimeout(() => {
    clearCbTimeout(mailbox, id)
    if (mailbox.requests[id]) {
      delete mailbox.requests[id]
    }
    const eMsg = util.format(`rpc ${mailbox.serverId} callback timeout ${mailbox.timeoutValue}, remote server ${id} host: ${mailbox.host}, port: ${mailbox.port}`)
    logger.error(eMsg)
    cb(tracer, new Error(eMsg))
  }, mailbox.timeoutValue)
  mailbox.timeout[id] = timer
}

const clearCbTimeout = (mailbox, id) => {
  if (!mailbox.timeout[id]) {
    logger.warn(`timer is not exsits, serverId: ${mailbox.serverId} remote: ${id}, host: ${mailbox.host}, port: ${mailbox.port}`)
    return
  }
  clearTimeout(mailbox.timeout[id])
  delete mailbox.timeout[id]
}

const MailBox = function (server, opts) {
  EventEmitter.call(this)
  this.curId = 0
  this.id = server.id
  this.host = server.host
  this.port = server.port
  this.requests = {}
  this.timeout = {}
  this.queue = []
  this.bufferMsg = opts.bufferMsg
  this.keepalive = opts.keepalive || Constants.DEFAULT_PARAM.KEEPALIVE
  this.interval = opts.interval || Constants.DEFAULT_PARAM.INTERVAL
  this.timeoutValue = opts.timeout || Constants.DEFAULT_PARAM.CALLBACK_TIMEOUT
  this.keepaliveTimer = null
  this.lastPing = -1
  this.lastPong = -1
  this.connected = false
  this.closed = false
  this.opts = opts
  this.serverId = opts.context.serverId
}

util.inherits(MailBox, EventEmitter)

MailBox.prototype.connect = function (tracer, cb) {
  tracer && tracer.info('client', __filename, 'connect', 'mqtt-mailbox try to connect')
  if (this.connected) {
    tracer && tracer.error('client', __filename, 'connect', 'mailbox has already connected')
    return cb(new Error('mailbox has already connected.'))
  }

  const stream = net.createConnection(this.port, this.host)
  this.socket = MqttCon(stream)

  const connectTimeout = setTimeout(() => {
    logger.error(`rpc client ${this.serverId} connect to remote server ${this.id} timeout`)
    this.emit('close', this.id)
  }, CONNECT_TIMEOUT)

  this.socket.connect({
    clientId: `MQTT_RPC_${Date.now()}`
  }, () => {
    if (this.connected) return

    clearTimeout(connectTimeout)
    this.connected = true
    if (this.bufferMsg) {
      this._interval = setInterval(() => {
        flush(this)
      }, this.interval)
    }

    this.setupKeepAlive()
    cb()
  })

  this.socket.on('publish', (pkg) => {
    pkg = pkg.payload.toString()
    try {
      pkg = JSON.parse(pkg)
      if (Array.isArray(pkg)) {
        processMsgs(this, pkg)
      } else {
        processMsg(this, pkg)
      }
    } catch (err) {
      logger.error(`rpc client ${this.serverId} process remote server ${this.id} message with error: ${err.stack}`)
    }
  })

  this.socket.on('error', (err) => {
    logger.error(`rpc socket ${this.serverId} is error, remote server ${this.id} host: ${this.host}, port: ${this.port}`)
    this.emit('close', this.id)
  })

  this.socket.on('pingresp', () => {
    this.lastPong = Date.now()
  })

  this.socket.on('disconnect', (reason) => {
    logger.error(`rpc socket ${this.serverId} is disconnect from remote server ${this.id}, reason: ${reason}`)
    for (let id in this.requests) {
      const ReqCb = this.requests[id]
      ReqCb(tracer, new Error(`${this.serverId} disconnect with remote server ${this.id}`))
    }
    this.emit('close', this.id)
  })
}

/**
 * close mailbox
 */
MailBox.prototype.close = function () {
  if (this.closed) return
  this.closed = true
  this.connected = false
  if (this._interval) {
    clearInterval(this._interval)
    this._interval = null
  }
  this.socket.destroy()
}

/**
 * send message to remote server
 *
 * @param msg {service:'', method:'', args:[]}
 * @param opts {} attach info to send method
 * @param cb declaration decided by remote interface
 */
MailBox.prototype.send = function (tracer, msg, opts, cb) {
  tracer && tracer.info('client', __filename, 'send', 'mqtt-mailbox try to send')
  if (!this.connected) {
    tracer && tracer.error('client', __filename, 'send', 'mqtt-mailbox not init')
    cb(tracer, new Error(`${this.serverId} mqtt-mailbox is not init ${this.id}`))
    return
  }

  if (this.closed) {
    tracer && tracer.error('client', __filename, 'send', 'mailbox has already closed')
    cb(tracer, new Error(`${this.serverId} mqtt-mailbox has already closed ${this.id}`))
    return
  }

  const id = this.curId++
  this.requests[id] = cb
  setCbTimeout(this, id, tracer, cb)

  const pkg = tracer && tracer.isEnabled ? {
    traceId: tracer.id,
    seqId: tracer.seq,
    source: tracer.source,
    remote: tracer.remote,
    id,
    msg
  } : { id, msg }
  if (this.bufferMsg) {
    enqueue(this, pkg)
  } else {
    doSend(this.socket, pkg)
  }
}

MailBox.prototype.setupKeepAlive = function () {
  this.keepaliveTimer = setInterval(() => {
    this.checkKeepAlive()
  }, this.keepalive)
}

MailBox.prototype.checkKeepAlive = function () {
  if (this.closed) return

  const now = Date.now()
  const KEEP_ALIVE_TIMEOUT = this.keepalive * 2
  if (this.lastPing > 0) {
    if (this.lastPong < this.lastPing) {
      if (now - this.lastPing > KEEP_ALIVE_TIMEOUT) {
        logger.error(`mqtt rpc client ${this.serverId} checkKeepAlive timeout from remote server ${this.id} for ${KEEP_ALIVE_TIMEOUT} lastPing: ${this.lastPing} lastPong: ${this.lastPong}`)
        this.emit('close', this.id)
        this.lastPing = -1
        // this.close()
      }
    } else {
      this.socket.pingreq()
      this.lastPing = Date.now()
    }
  } else {
    this.socket.pingreq()
    this.lastPing = Date.now()
  }
}

/**
 * Factory method to create mailbox
 *
 * @param {Object} server remote server info {id:'', host:'', port:''}
 * @param {Object} opts construct parameters
 *                      opts.bufferMsg {Boolean} msg should be buffered or send immediately.
 *                      opts.interval {Boolean} msg queue flush interval if bufferMsg is true. default is 50 ms
 */
module.exports.create = function (server, opts = {}) {
  return new MailBox(server, opts)
}
