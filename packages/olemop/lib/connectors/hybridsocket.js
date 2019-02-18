const util = require('util')
const EventEmitter = require('events')
const protocol = require('@olemop/protocol')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const handler = require('./common/handler')

const Package = protocol.Package

const ST_INITED = 0
const ST_WAIT_ACK = 1
const ST_WORKING = 2
const ST_CLOSED = 3

/**
 * Socket class that wraps socket and websocket to provide unified interface for up level.
 */
const Socket = function (id, socket) {
  EventEmitter.call(this)
  this.id = id
  this.socket = socket

  if (!socket._socket) {
    this.remoteAddress = {
      ip: socket.address().address,
      port: socket.address().port
    }
  } else {
    this.remoteAddress = {
      ip: socket._socket.remoteAddress,
      port: socket._socket.remotePort
    }
  }

  socket.once('close', this.emit.bind(this, 'disconnect'))
  socket.on('error', this.emit.bind(this, 'error'))

  socket.on('message', (msg) => {
    if (msg) {
      msg = Package.decode(msg)
      handler(this, msg)
    }
  })

  this.state = ST_INITED

  // @todo: any other events?
}

util.inherits(Socket, EventEmitter)

module.exports = Socket

/**
 * Send raw byte data.
 *
 * @api private
 */
Socket.prototype.sendRaw = function (msg) {
  if (this.state !== ST_WORKING) return

  this.socket.send(msg, { binary: true }, (err) => {
    if (err) {
      logger.error('websocket send binary data failed: %j', err.stack)
    }
  })
}

/**
 * Send byte data package to client.
 *
 * @param  {Buffer} msg byte data
 */
Socket.prototype.send = function (msg) {
  if (msg instanceof String) {
    msg = new Buffer(msg)
  } else if (!(msg instanceof Buffer)) {
    msg = new Buffer(JSON.stringify(msg))
  }
  this.sendRaw(Package.encode(Package.TYPE_DATA, msg))
}

/**
 * Send byte data packages to client in batch.
 *
 * @param  {Buffer} msgs byte data
 */
Socket.prototype.sendBatch = function (msgs) {
  const rs = msgs.reduce((prev, item) => {
    const src = Package.encode(Package.TYPE_DATA, item)
    prev.push(src)
    return prev
  }, [])
  this.sendRaw(Buffer.concat(rs))
}

/**
 * Send message to client no matter whether handshake.
 *
 * @api private
 */
Socket.prototype.sendForce = function (msg) {
  if (this.state === ST_CLOSED) return
  this.socket.send(msg, { binary: true })
}

/**
 * Response handshake request
 *
 * @api private
 */
Socket.prototype.handshakeResponse = function (resp) {
  if (this.state !== ST_INITED) return
  this.socket.send(resp, { binary: true })
  this.state = ST_WAIT_ACK
}

/**
 * Close the connection.
 *
 * @api private
 */
Socket.prototype.disconnect = function () {
  if (this.state === ST_CLOSED) return

  this.state = ST_CLOSED
  this.socket.emit('close')
  this.socket.close()
}
