const util = require('util')
const EventEmitter = require('events')
const WebSocket = require('ws')
const logger = require('@olemop/logger').getLogger('olemop-rpc', __filename)
const Tracer = require('../../util/tracer')

// const DEFAULT_ZIP_LENGTH = 1024 * 10

let gid = 1

const ipFilter = function (obj) {
  if (typeof this.whitelist === 'function') {
    this.whitelist((err, tmpList) => {
      if (err) {
        logger.error('%j.(RPC whitelist).', err)
        return
      }
      if (!Array.isArray(tmpList)) {
        logger.error('%j is not an array.(RPC whitelist).', tmpList)
        return
      }
      if (obj && obj.ip && obj.id) {
        for (let i in tmpList) {
          const exp = new RegExp(tmpList[i])
          if (exp.test(obj.ip)) return
        }
        const sock = this.sockets[obj.id]
        if (sock) {
          sock.close()
          logger.warn(`${obj.ip} is rejected(RPC whitelist).`)
        }
      }
    })
  }
}

/**
 * copy the stack infos for Error instance json result is empty
 * @param {*} origin
 */
const cloneError = (origin) => ({ msg: origin.msg, stack: origin.stack })

const processMsg = function (socket, acceptor, pkg) {
  let tracer = null
  if (this.rpcDebugLog) {
    tracer = new Tracer(acceptor.rpcLogger, acceptor.rpcDebugLog, pkg.remote, pkg.source, pkg.msg, pkg.traceId, pkg.seqId)
    tracer.info('server', __filename, 'processMsg', 'ws-acceptor receive message and try to process message')
  }
  acceptor.cb(tracer, pkg.msg, (...args) => {
    // first callback argument can be error object, the others are message
    const errorArg = args[0]
    if (errorArg instanceof Error) {
      args[0] = cloneError(errorArg)
    }
    const resp = tracer && tracer.isEnabled ? {
      traceId: tracer.id,
      seqId: tracer.seq,
      source: tracer.source,
      id: pkg.id,
      resp: args
    } : {
      id: pkg.id,
      resp: args
    }
    if (acceptor.bufferMsg) {
      enqueue(socket, acceptor, resp)
    } else {
      doSend(socket, resp)
    }
  })
}

const processMsgs = (socket, acceptor, pkgs) => {
  pkgs.forEach((item) => {
    processMsg(socket, acceptor, item)
  })
}

const enqueue = (socket, acceptor, msg) => {
  let queue = acceptor.msgQueues[socket.id]
  if (!queue) {
    queue = acceptor.msgQueues[socket.id] = []
  }
  queue.push(msg)
}

const flush = (acceptor) => {
  const queues = acceptor.msgQueues
  for (let socketId in queues) {
    const socket = acceptor.sockets[socketId]
    if (!socket) {
      // clear pending messages if the socket not exist any more
      delete queues[socketId]
      continue
    }
    const queue = queues[socketId]

    if (!queue.length) continue

    doSend(socket, queue)
    //    socket.send(JSON.stringify({body: queue}))
    queues[socketId] = []
  }
}

const doSend = (socket, dataObj) => {
  // console.log(`ws rpc server send str = ${str}`)
  // console.log(`ws rpc server send str len = ${str.length}`)
  // console.log(`ws rpc server send message, len = ${str.length}`)
  socket.send(JSON.stringify({
    body: dataObj
  }))
}

const Acceptor = function (opts, cb) {
  EventEmitter.call(this)
  this.bufferMsg = opts.bufferMsg
  // flush interval in ms
  this.interval = opts.interval
  this.rpcDebugLog = opts.rpcDebugLog
  this.rpcLogger = opts.rpcLogger
  this.whitelist = opts.whitelist
  // interval object
  this._interval = null
  this.sockets = {}
  this.msgQueues = {}
  this.cb = cb
  // DEFAULT_ZIP_LENGTH = opts.doZipLength || DEFAULT_ZIP_LENGTH
  // useZipCompress = opts.useZipCompress || false
}

util.inherits(Acceptor, EventEmitter)

Acceptor.prototype.listen = function (port) {
  // check status
  if (this.inited) {
    this.cb(new Error('already inited.'))
    return
  }
  this.inited = true

  this.server = new WebSocket.Server({
    port: port
  })

  this.server.on('error', (err) => {
    this.emit('error', err)
  })

  this.server.on('connection', (socket) => {
    const id = gid++
    socket.id = id
    this.sockets[id] = socket

    this.emit('connection', {
      id,
      ip: socket._socket.remoteAddress
    })

    socket.on('message', (data, flags) => {
      try {
        // console.log("ws rpc server received message = " + data)
        const msg = JSON.parse(data)

        if (Array.isArray(msg.body)) {
          processMsgs(socket, this, msg.body)
        } else {
          processMsg(socket, this, msg.body)
        }
      } catch (e) {
        console.error(`ws rpc server process message with error: ${e.stack}`)
      }
    })

    socket.on('close', (code, message) => {
      delete this.sockets[id]
      delete this.msgQueues[id]
    })
  })

  this.on('connection', ipFilter.bind(this))

  if (this.bufferMsg) {
    this._interval = setInterval(() => {
      flush(this)
    }, this.interval)
  }
}

Acceptor.prototype.close = function () {
  if (this.closed) {
    return
  }
  this.closed = true
  if (this._interval) {
    clearInterval(this._interval)
    this._interval = null
  }
  try {
    this.server.close()
  } catch (err) {
    console.error(`rpc server close error: ${err.stack}`)
  }
  this.emit('closed')
}

/**
 * create acceptor
 *
 * @param opts init params
 * @param cb(tracer, msg, cb) callback function that would be invoked when new message arrives
 */
module.exports.create = function (opts = {}, cb) {
  return new Acceptor(opts, cb)
}
