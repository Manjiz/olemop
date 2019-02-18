const util = require('util')
const EventEmitter = require('events')

const ST_INITED = 0
const ST_CLOSED = 1

/**
 * Socket class that wraps socket.io socket to provide unified interface for up level.
 */
const Socket = function (id, socket) {
  EventEmitter.call(this)
  this.id = id
  this.socket = socket
  this.remoteAddress = {
    ip: socket.handshake.address.address,
    port: socket.handshake.address.port
  }

  socket.on('disconnect', this.emit.bind(this, 'disconnect'))

  socket.on('error', this.emit.bind(this, 'error'))

  socket.on('message', (msg) => {
    this.emit('message', msg)
  })

  this.state = ST_INITED

  // @todo: any other events?
}

util.inherits(Socket, EventEmitter)

module.exports = Socket

Socket.prototype.send = function (msg) {
  if (this.state !== ST_INITED) return
  if (typeof msg !== 'string') {
    msg = JSON.stringify(msg)
  }
  this.socket.send(msg)
}

Socket.prototype.disconnect = function () {
  if (this.state === ST_CLOSED) return
  this.state = ST_CLOSED
  this.socket.disconnect()
}

Socket.prototype.sendBatch = function (msgs) {
  this.send(encodeBatch(msgs))
}

/**
 * Encode batch msg to client
 */
const encodeBatch = (msgs) => {
  const joinStr = msgs.map((msg) => {
    return typeof msg === 'string' ? msg : JSON.stringify(msg)
  }).join(',')
  return `[${joinStr}]`
}
