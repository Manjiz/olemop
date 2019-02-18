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

const Socket = function (id, socket, peer) {
	EventEmitter.call(this)

  this.id = id
	this.socket = socket
  this.peer = peer
	this.host = peer.address
	this.port = peer.port
	this.remoteAddress = {
    ip: this.host,
    port: this.port
  }

  this.on('package', (pkg) => {
    if (pkg) {
      pkg = Package.decode(pkg)
      handler(this, pkg)
    }
  })

  this.state = ST_INITED
}

util.inherits(Socket, EventEmitter)

module.exports = Socket

/**
 * Send byte data package to client.
 *
 * @param  {Buffer} msg byte data
 */
Socket.prototype.send = function (msg) {
  if (this.state !== ST_WORKING) return
  if (msg instanceof String) {
    msg = new Buffer(msg)
  } else if (!(msg instanceof Buffer)) {
    msg = new Buffer(JSON.stringify(msg))
  }
  this.sendRaw(Package.encode(Package.TYPE_DATA, msg))
}

Socket.prototype.sendRaw = function (msg) {
	this.socket.send(msg, 0, msg.length, this.port, this.host, (err, bytes) => {
    if (err)	{
      logger.error('send msg to remote with err: %j', err.stack)
    }
  })
}

Socket.prototype.sendForce = function (msg) {
  if (this.state === ST_CLOSED) return
  this.sendRaw(msg)
}

Socket.prototype.handshakeResponse = function (resp) {
  if (this.state !== ST_INITED) return
  this.sendRaw(resp)
  this.state = ST_WAIT_ACK
}

Socket.prototype.sendBatch = function (msgs) {
  if (this.state !== ST_WORKING) return
  const rs = msgs.reduce((prev, msg) => {
    const src = Package.encode(Package.TYPE_DATA, msg)
    prev.push(src)
    return prev
  }, [])
  this.sendRaw(Buffer.concat(rs))
}

Socket.prototype.disconnect = function () {
  if (this.state === ST_CLOSED) return
  this.state = ST_CLOSED
  this.emit('disconnect', 'the connection is disconnected.')
}
