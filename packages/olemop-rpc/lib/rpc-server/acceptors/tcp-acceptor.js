const net = require('net')
const util = require('util')
const EventEmitter = require('events')
const Composer = require('stream-pkg')
const Tracer = require('../../util/tracer')
const utils = require('../../util/utils')

/**
 * copy the stack infos for Error instance json result is empty
 * @param {*} origin
 */
const cloneError = (origin) => ({ msg: origin.msg, stack: origin.stack })

const processMsg = (socket, acceptor, pkg) => {
  const tracer = new Tracer(acceptor.rpcLogger, acceptor.rpcDebugLog, pkg.remote, pkg.source, pkg.msg, pkg.traceId, pkg.seqId)
  tracer.info('server', __filename, 'processMsg', 'tcp-acceptor receive message and try to process message')
  acceptor.cb(tracer, pkg.msg, (...args) => {
    args.forEach((item) => {
      if (item instanceof Error) {
        item = cloneError(item)
      }
    })
    const resp = tracer.isEnabled ? {
      traceId: tracer.id,
      seqId: tracer.seq,
      source: tracer.source,
      id: pkg.id,
      resp: Array.prototype.slice.call(args, 0)
    } : {
      id: pkg.id,
      resp: Array.prototype.slice.call(args, 0)
    }
    if (acceptor.bufferMsg) {
      enqueue(socket, acceptor, resp)
    } else {
      socket.write(socket.composer.compose(JSON.stringify(resp)))
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

    socket.write(socket.composer.compose(JSON.stringify(queue)))
    queues[socketId] = []
  }
}

const Acceptor = function (opts, cb) {
  EventEmitter.call(this)
  opts = opts || {}
  this.bufferMsg = opts.bufferMsg
  // flush interval in ms
  this.interval = opts.interval
  this.pkgSize = opts.pkgSize
  // interval object
  this._interval = null
  this.server = null
  this.sockets = {}
  this.msgQueues = {}
  this.cb = cb
}

util.inherits(Acceptor, EventEmitter)

Acceptor.prototype.listen = function (port) {
  // check status
  if (this.inited) {
    utils.invokeCallback(this.cb, new Error('already inited.'))
    return
  }
  this.inited = true

  this.server = net.createServer()
  this.server.listen(port)

  this.server.on('error', (err) => {
    this.emit('error', err, this)
  })

  this.server.on('connection', (socket) => {
    this.sockets[socket.id] = socket
    socket.composer = new Composer({
      maxLength: this.pkgSize
    })

    socket.on('data', (data) => {
      socket.composer.feed(data)
    })

    socket.composer.on('data', (data) => {
      const pkg = JSON.parse(data.toString())
      if (Array.isArray(pkg)) {
        processMsgs(socket, this, pkg)
      } else {
        processMsg(socket, this, pkg)
      }
    })

    socket.on('close', () => {
      delete this.sockets[socket.id]
      delete this.msgQueues[socket.id]
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
module.exports.create = function (opts, cb) {
  return new Acceptor(opts || {}, cb)
}

process.on('SIGINT', () => {
  process.exit()
})
