const util = require('util')
const EventEmitter = require('events')

const ST_INITED = 1
const ST_CLOSED = 2

/**
 * Socket class that wraps socket and websocket to provide unified interface for up level.
 */
const Socket = function (id, socket, adaptor) {
  EventEmitter.call(this)
  this.id = id
  this.socket = socket
  this.remoteAddress = {
    ip: socket.stream.remoteAddress,
    port: socket.stream.remotePort
  }
  this.adaptor = adaptor

  socket.on('close', this.emit.bind(this, 'disconnect'))
  socket.on('error', this.emit.bind(this, 'disconnect'))
  socket.on('disconnect', this.emit.bind(this, 'disconnect'))

  socket.on('pingreq', (packet) => {
    socket.pingresp()
  })

  socket.on('subscribe', this.adaptor.onSubscribe.bind(this.adaptor, this))

  socket.on('publish', this.adaptor.onPublish.bind(this.adaptor, this))

  this.state = ST_INITED

  // @todo: any other events?
}

util.inherits(Socket, EventEmitter)

module.exports = Socket

Socket.prototype.send = function (msg) {
  if (this.state !== ST_INITED) return
  if (msg instanceof Buffer) {
    // if encoded, send directly
    this.socket.stream.write(msg)
  } else {
    this.adaptor.publish(this, msg)
  }
}

Socket.prototype.sendBatch = function (msgs) {
  msgs.forEach((item) => {
    this.send(item)
  })
}

Socket.prototype.disconnect = function () {
  if (this.state === ST_CLOSED) return
  this.state = ST_CLOSED
  this.socket.stream.destroy()
}
