const net = require('net')
const util = require('util')
const EventEmitter = require('events')
const Composer = require('stream-pkg')
const Tracer = require('../../util/tracer')
const utils = require('../../util/utils')

const DEFAULT_CALLBACK_TIMEOUT = 10 * 1000
const DEFAULT_INTERVAL = 50

const enqueue = (mailbox, msg) => {
  mailbox.queue.push(msg)
}

const flush = (mailbox) => {
  if (mailbox.closed || !mailbox.queue.length) return
  mailbox.socket.write(mailbox.composer.compose(JSON.stringify(mailbox.queue)))
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

  const tracer = new Tracer(mailbox.opts.rpcLogger, mailbox.opts.rpcDebugLog, mailbox.opts.clientId, pkg.source, pkg.resp, pkg.traceId, pkg.seqId)
  const args = [tracer, null]

  pkg.resp.forEach((arg) => {
    args.push(arg)
  })

  cb.apply(null, args)
}

const setCbTimeout = (mailbox, id, tracer, cb) => {
  const timer = setTimeout(() => {
    clearCbTimeout(mailbox, id)
    if (mailbox.requests[id]) {
      delete mailbox.requests[id]
    }
    logger.error(`rpc callback timeout, remote server host: ${mailbox.host}, port: ${mailbox.port}`)
    utils.invokeCallback(cb, tracer, new Error('rpc callback timeout'))
  }, mailbox.timeoutValue)
  mailbox.timeout[id] = timer
}

const clearCbTimeout = (mailbox, id) => {
  if (!mailbox.timeout[id]) {
    console.warn(`timer not exists, id: ${id}`)
    return
  }
  clearTimeout(mailbox.timeout[id])
  delete mailbox.timeout[id]
}

const MailBox = function (server, opts) {
  EventEmitter.call(this)
  this.opts = opts || {}
  this.id = server.id
  this.host = server.host
  this.port = server.port
  this.socket = null
  this.composer = new Composer({
    maxLength: opts.pkgSize
  })
  this.requests = {}
  this.timeout = {}
  this.curId = 0
  this.queue = []
  this.bufferMsg = opts.bufferMsg
  this.interval = opts.interval || DEFAULT_INTERVAL
  this.timeoutValue = opts.timeout || DEFAULT_CALLBACK_TIMEOUT
  this.connected = false
  this.closed = false
}

util.inherits(MailBox, EventEmitter)

MailBox.prototype.connect = function (tracer, cb) {
  tracer.info('client', __filename, 'connect', 'tcp-mailbox try to connect')
  if (this.connected) {
    utils.invokeCallback(cb, new Error('mailbox has already connected.'))
    return
  }

  this.socket = net.connect({
    port: this.port,
    host: this.host
  }, (err) => {
    // success to connect
    this.connected = true
    if (this.bufferMsg) {
      // start flush interval
      this._interval = setInterval(() => {
        flush(this)
      }, this.interval)
    }
    utils.invokeCallback(cb, err)
  })

  this.composer.on('data', (data) => {
    const pkg = JSON.parse(data.toString())
    if (Array.isArray(pkg)) {
      processMsgs(this, pkg)
    } else {
      processMsg(this, pkg)
    }
  })

  this.socket.on('data', (data) => {
    this.composer.feed(data)
  })

  this.socket.on('error', (err) => {
    if (!this.connected) {
      utils.invokeCallback(cb, err)
      return
    }
    this.emit('error', err, this)
  })

  this.socket.on('end', () => {
    this.emit('close', this.id)
  })

  // TODO: reconnect and heartbeat
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
  if (this.socket) {
    this.socket.end()
    this.socket = null
  }
}

/**
 * send message to remote server
 *
 * @param msg {service:'', method:'', args:[]}
 * @param opts {} attach info to send method
 * @param cb declaration decided by remote interface
 */
MailBox.prototype.send = function (tracer, msg, opts, cb) {
  tracer.info('client', __filename, 'send', 'tcp-mailbox try to send')
  if (!this.connected) {
    utils.invokeCallback(cb, tracer, new Error('not init.'))
    return
  }

  if (this.closed) {
    utils.invokeCallback(cb, tracer, new Error('mailbox alread closed.'))
    return
  }

  const id = this.curId++
  this.requests[id] = cb
  setCbTimeout(this, id, tracer, cb)
  const pkg = tracer.isEnabled ? {
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
    this.socket.write(this.composer.compose(JSON.stringify(pkg)))
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
module.exports.create = function (server, opts) {
  return new MailBox(server, opts || {})
}
