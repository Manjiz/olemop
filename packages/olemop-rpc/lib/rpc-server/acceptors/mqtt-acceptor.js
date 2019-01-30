const net = require('net')
const util = require('util')
const EventEmitter = require('events')
const MqttCon = require('mqtt-connection')
const logger = require('@olemop/logger').getLogger('olemop-rpc', 'mqtt-acceptor')
const Tracer = require('../../util/tracer')

let curId = 1

const cloneError = (origin) => {
  // copy the stack infos for Error instance json result is empty
  return { msg: origin.msg, stack: origin.stack }
}

const processMsg = function (socket, acceptor, pkg) {
  let tracer = null
  if (this.rpcDebugLog) {
    tracer = new Tracer(acceptor.rpcLogger, acceptor.rpcDebugLog, pkg.remote, pkg.source, pkg.msg, pkg.traceId, pkg.seqId)
    tracer.info('server', __filename, 'processMsg', 'mqtt-acceptor receive message and try to process message')
  }
  acceptor.cb(tracer, pkg.msg, (...args) => {
    // first callback argument can be error object, the others are message
    const errorArg = args[0]
    if (errorArg && errorArg instanceof Error) {
      args[0] = cloneError(errorArg)
    }

    const resp = tracer && tracer.isEnabled ? {
      traceId: tracer.id,
      seqId: tracer.seq,
      source: tracer.source,
      id: pkg.id,
      resp: args
    } : { id: pkg.id, resp: args }
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
    queues[socketId] = []
  }
}

const doSend = (socket, msg) => {
  socket.publish({
    topic: 'rpc',
    payload: JSON.stringify(msg)
  })
}

const Acceptor = function (opts, cb) {
  EventEmitter.call(this)
  // flush interval in ms
  this.interval = opts.interval
  this.bufferMsg = opts.bufferMsg
  this.rpcLogger = opts.rpcLogger
  this.rpcDebugLog = opts.rpcDebugLog
  // interval object
  this._interval = null
  this.sockets = {}
  this.msgQueues = {}
  this.cb = cb
}

util.inherits(Acceptor, EventEmitter)

Acceptor.prototype.listen = function (port) {
  // check status
  if (this.inited) {
    this.cb(new Error('already inited.'))
    return
  }
  this.inited = true

  this.server = new net.Server()
  this.server.listen(port)

  this.server.on('error', (err) => {
    logger.error(`rpc server is error: ${err.stack}`)
    this.emit('error', err)
  })

  this.server.on('connection', (stream) => {
    const socket = MqttCon(stream)
    socket['id'] = curId++

    socket.on('connect', (pkg) => {
    })

    socket.on('publish', (pkg) => {
      pkg = pkg.payload.toString()
      let isArray = false
      try {
        pkg = JSON.parse(pkg)
        if (Array.isArray(pkg)) {
          processMsgs(socket, this, pkg)
          isArray = true
        } else {
          processMsg(socket, this, pkg)
        }
      } catch (err) {
        if (!isArray) {
          doSend(socket, { id: pkg.id, resp: [cloneError(err)] })
        }
        logger.error(`process rpc message error ${err.stack}`)
      }
    })

    socket.on('pingreq', () => {
      socket.pingresp()
    })

    socket.on('error', () => {
      this.onSocketClose(socket)
    })

    socket.on('close', () => {
      this.onSocketClose(socket)
    })

    this.sockets[socket.id] = socket

    socket.on('disconnect', (reason) => {
      this.onSocketClose(socket)
    })
  })

  if (this.bufferMsg) {
    this._interval = setInterval(() => {
      flush(this)
    }, this.interval)
  }
}

Acceptor.prototype.close = function () {
  if (this.closed) return
  this.closed = true
  if (this._interval) {
    clearInterval(this._interval)
    this._interval = null
  }
  this.server.close()
  this.emit('closed')
}

Acceptor.prototype.onSocketClose = function (socket) {
  if (!socket['closed']) {
    socket['closed'] = true
    delete this.sockets[socket.id]
    delete this.msgQueues[socket.id]
  }
}

/**
 * create acceptor
 *
 * @param opts init params
 * @param cb(tracer, msg, cb) callback function that would be invoked when new message arrives
 */
module.exports.create = function (opts, cb) {
  return new Acceptor(opts || {}, cb)
}
