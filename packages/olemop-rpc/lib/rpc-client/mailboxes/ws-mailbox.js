const util = require('util')
const EventEmitter = require('events')
const client = require('socket.io-client')
const logger = require('@olemop/logger').getLogger('olemop-rpc', 'ws-mailbox')
const constants = require('../../util/constants')
const Tracer = require('../../util/tracer')

const enqueue = (mailbox, msg) => {
  mailbox.queue.push(msg)
}

const flush = (mailbox) => {
  if (mailbox.closed || !mailbox.queue.length) return

  mailbox.socket.emit('message', mailbox.queue)
  mailbox.queue = []
}

const processMsgs = (mailbox, pkgs) => {
  pkgs.forEach((item) => {
    processMsg(mailbox, item)
  })
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
  const pkgResp = pkg.resp
  // const args = [tracer, null]

  // pkg.resp.forEach((arg) => {
  //   args.push(arg)
  // })

  cb(tracer, sendErr, pkgResp)
}

const setCbTimeout = (mailbox, id, tracer, cb) => {
  const timer = setTimeout(() => {
    logger.warn(`rpc request is timeout, id: ${id}, host: ${mailbox.host}, port: ${ mailbox.port}`)
    clearCbTimeout(mailbox, id)
    if (mailbox.requests[id]) {
      delete mailbox.requests[id]
    }
    logger.error(`rpc callback timeout, remote server host: ${mailbox.host}, port: ${mailbox.port}`)
    cb(tracer, new Error('rpc callback timeout'))
  }, mailbox.timeoutValue)
  mailbox.timeout[id] = timer
}

const clearCbTimeout = (mailbox, id) => {
  if (!mailbox.timeout[id]) {
    logger.warn(`timer is not exsits, id: ${id}, host: ${mailbox.host}, port: ${mailbox.port}`)
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
  this.interval = opts.interval || constants.DEFAULT_PARAM.INTERVAL
  this.timeoutValue = opts.timeout || constants.DEFAULT_PARAM.CALLBACK_TIMEOUT
  this.connected = false
  this.closed = false
  this.opts = opts
}

util.inherits(MailBox, EventEmitter)

MailBox.prototype.connect = function (tracer, cb) {
  tracer && tracer.info('client', __filename, 'connect', 'ws-mailbox try to connect')
  if (this.connected) {
    tracer && tracer.error('client', __filename, 'connect', 'mailbox has already connected')
    cb(new Error('mailbox has already connected.'))
    return
  }
  this.socket = client.connect(`${this.host}:${this.port}`, {
    'force new connection': true,
    'reconnect': false
  })
  this.socket.on('message', (pkg) => {
    try {
      if (Array.isArray(pkg)) {
        processMsgs(this, pkg)
      } else {
        processMsg(this, pkg)
      }
    } catch (err) {
      logger.error(`rpc client process message with error: ${err.stack}`)
    }
  })

  this.socket.on('connect', () => {
    if (this.connected) {
      return
    }
    this.connected = true
    if (this.bufferMsg) {
      this._interval = setInterval(() => {
        flush(this)
      }, this.interval)
    }
    cb()
  })

  this.socket.on('error', (err) => {
    logger.error(`rpc socket is error, remote server host: ${this.host}, port: ${this.port}`)
    this.emit('close', this.id)
    cb(err)
  })

  this.socket.on('disconnect', (reason) => {
    logger.error(`rpc socket is disconnect, reason: ${reason}`)
    for (let id in this.requests) {
      const cb = this.requests[id]
      cb(tracer, new Error('disconnect with remote server.'))
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
  this.socket.disconnect()
}

/**
 * send message to remote server
 *
 * @param msg {service:'', method:'', args:[]}
 * @param opts {} attach info to send method
 * @param cb declaration decided by remote interface
 */
MailBox.prototype.send = function (tracer, msg, opts, cb) {
  tracer && tracer.info('client', __filename, 'send', 'ws-mailbox try to send')
  if (!this.connected) {
    tracer && tracer.error('client', __filename, 'send', 'ws-mailbox not init')
    cb(tracer, new Error('ws-mailbox is not init'))
    return
  }

  if (this.closed) {
    tracer && tracer.error('client', __filename, 'send', 'mailbox has already closed')
    cb(tracer, new Error('ws-mailbox has already closed'))
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
    this.socket.emit('message', pkg)
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
