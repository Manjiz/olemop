const util = require('util')
const EventEmitter = require('events')
const wsClient = require('ws')
const utils = require('../../util/utils')
const Tracer = require('../../util/tracer')

const DEFAULT_CALLBACK_TIMEOUT = 10 * 1000
const DEFAULT_INTERVAL = 50
const KEEP_ALIVE_TIMEOUT = 10 * 1000
const KEEP_ALIVE_INTERVAL = 30 * 1000
// const DEFAULT_ZIP_LENGTH = 1024 * 10

const enqueue = (mailbox, msg) => {
  mailbox.queue.push(msg)
}

const flush = (mailbox) => {
  if (mailbox.closed || !mailbox.queue.length) return

  doSend(mailbox.socket, mailbox.queue)
  //mailbox.socket.send(JSON.stringify({body: mailbox.queue}))
  mailbox.queue = []
}

const doSend = (socket, dataObj) => {
  const str = JSON.stringify({ body: dataObj })
  // console.log(`ws rpc client send str = ${str}`)
  // console.log(`ws rpc client send str len = ${str.length}`)
  // console.log(`ws rpc client send message, len = ${str.length}`)
  socket.send(str)
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

const checkKeepAlive = (mailbox) => {
  if (mailbox.closed) return

  const now = Date.now()
  if (mailbox._KP_last_ping_time > 0) {
    if (mailbox._KP_last_pong_time < mailbox._KP_last_ping_time) {
      if (now - mailbox._KP_last_ping_time > KEEP_ALIVE_TIMEOUT) {
        console.error('ws rpc client checkKeepAlive error because > KEEP_ALIVE_TIMEOUT')
        mailbox.close()
      }
      return
    }
    if (mailbox._KP_last_pong_time >= mailbox._KP_last_ping_time) {
      mailbox.socket.ping()
      mailbox._KP_last_ping_time = Date.now()
      return
    }
  } else {
    mailbox.socket.ping()
    mailbox._KP_last_ping_time = Date.now()
  }
}

const setCbTimeout = (mailbox, id) => {
  const timer = setTimeout(() => {
    clearCbTimeout(mailbox, id)
    if (mailbox.requests[id]) {
      delete mailbox.requests[id]
    }
  }, mailbox.timeoutValue)
  mailbox.timeout[id] = timer
}

const clearCbTimeout = (mailbox, id) => {
  if (!mailbox.timeout[id]) {
    console.warn(`timer is not exsits, id: ${id}`)
    return
  }
  clearTimeout(mailbox.timeout[id])
  delete mailbox.timeout[id]
}

const MailBox = function (server, opts) {
  EventEmitter.call(this)
  this.id = server.id
  this.host = server.host
  this.port = server.port
  this.requests = {}
  this.timeout = {}
  this.curId = 0
  this.queue = []
  this.bufferMsg = opts.bufferMsg
  this.interval = opts.interval || DEFAULT_INTERVAL
  this.timeoutValue = opts.timeout || DEFAULT_CALLBACK_TIMEOUT
  this.connected = false
  this.closed = false
  this.opts = opts
  this._KPinterval = null
  this._KP_last_ping_time = -1
  this._KP_last_pong_time = -1
  // DEFAULT_ZIP_LENGTH = opts.doZipLength || DEFAULT_ZIP_LENGTH
  // useZipCompress = opts.useZipCompress || false
}

util.inherits(MailBox, EventEmitter)

MailBox.prototype.connect = function (tracer, cb) {
  tracer && tracer.info('client', __filename, 'connect', 'ws-mailbox try to connect')
  if (this.connected) {
    tracer && tracer.error('client', __filename, 'connect', 'mailbox has already connected')
    cb(new Error('mailbox has already connected.'))
    return
  }

  this.socket = wsClient.connect(`ws://${this.host}:${this.port}`)
  //this.socket = wsClient.connect(`${this.host}:${this.port}, {'force new connection': true, 'reconnect': false})

  this.socket.on('message', (data, flags) => {
    try {
      const msg = JSON.parse(data)

      if (Array.isArray(msg.body)) {
        processMsgs(this, msg.body)
      } else {
        processMsg(this, msg.body)
      }
    } catch (e) {
      console.error(`ws rpc client process message with error: ${e.stack}`)
    }
  })

  this.socket.on('open', () => {
    // ignore reconnect
    if (this.connected) return

    // success to connect
    this.connected = true

    if (this.bufferMsg) {
      // start flush interval
      this._interval = setInterval(() => {
        flush(this)
      }, this.interval)
    }
    this._KPinterval = setInterval(() => {
      checkKeepAlive(this)
    }, KEEP_ALIVE_INTERVAL)
    utils.invokeCallback(cb)
  })

  this.socket.on('error', (err) => {
    utils.invokeCallback(cb, err)
    this.close()
  })

  this.socket.on('close', (code, message) => {
    for (let id in this.requests) {
      const cb = this.requests[id]
      utils.invokeCallback(cb, new Error('disconnect with remote server.'))
    }
    this.emit('close', this.id)
    this.close()
  })

  // this.socket.on('ping', (data, flags) => {
  // })
  this.socket.on('pong', (data, flags) => {
    // console.log(`ws received pong: ${data}`)
    this._KP_last_pong_time = Date.now()
  })

}

/**
 * close mailbox
 */
MailBox.prototype.close = function () {
  if (this.closed) {
    return
  }
  this.closed = true
  this.connected = false
  if (this._interval) {
    clearInterval(this._interval)
    this._interval = null
  }
  if (this._KPinterval) {
    clearInterval(this._KPinterval)
    this._KPinterval = null
  }
  this.socket.close()
  this._KP_last_ping_time = -1
  this._KP_last_pong_time = -1
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
    cb(tracer, new Error('not init.'))
    return
  }

  if (this.closed) {
    tracer && tracer.error('client', __filename, 'send', 'mailbox alread closed')
    cb(tracer, new Error('mailbox alread closed.'))
    return
  }

  const id = this.curId++
  this.requests[id] = cb
  setCbTimeout(this, id)

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
    // this.socket.send(JSON.stringify({ body: pkg }))
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
