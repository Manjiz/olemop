const util = require('util')
const EventEmitter = require('events')
const httpServer = require('http').createServer()
const socketIO = require('socket.io')
const SioSocket = require('./siosocket')

const PKG_ID_BYTES = 4
const PKG_ROUTE_LENGTH_BYTES = 1
const PKG_HEAD_BYTES = PKG_ID_BYTES + PKG_ROUTE_LENGTH_BYTES

let curId = 1

/**
 * Connector that manager low level connection and protocol bewteen server and client.
 * Develper can provide their own connector to switch the low level prototol, such as tcp or probuf.
 */
const Connector = function (port, host, opts) {
  if (!(this instanceof Connector)) {
    return new Connector(port, host, opts)
  }

  EventEmitter.call(this)
  this.port = port
  this.host = host
  this.opts = opts
  // this.heartbeats = opts.heartbeats || true
  // this.closeTimeout = opts.closeTimeout || 60
  this.heartbeatTimeout = opts.heartbeatTimeout || 60000
  this.heartbeatInterval = opts.heartbeatInterval || 25000
}

util.inherits(Connector, EventEmitter)

module.exports = Connector

/**
 * Start connector to listen the specified port
 */
Connector.prototype.start = function (cb) {
  const sio = socketIO(httpServer, Object.assign({
    path: '/socket.io',
    pingTimeout: this.heartbeatTimeout,
    pingInterval: this.heartbeatInterval,
    transports: !this.opts && [
      'websocket', 'polling-xhr', 'polling-jsonp', 'polling'
    ]
  }, this.opts))

  const port = this.port
  httpServer.listen(port, () => {
    console.log(`sio Server listening at port ${port}`)
  })

  sio.on('connection', (socket) => {
    const siosocket = new SioSocket(curId++, socket)
    this.emit('connection', siosocket)
    siosocket.on('closing', (reason) => {
      siosocket.send({route: 'onKick', reason: reason})
    })
  })

  process.nextTick(cb)
}

/**
 * Stop connector
 */
Connector.prototype.stop = function (force, cb) {
  this.wsocket.server.close()
  process.nextTick(cb)
}

Connector.encode = Connector.prototype.encode = function (reqId, route, msg) {
  return reqId ? composeResponse(reqId, route, msg) : composePush(route, msg)
}

/**
 * Decode client message package.
 *
 * Package format:
 *   message id: 4bytes big-endian integer
 *   route length: 1byte
 *   route: route length bytes
 *   body: the rest bytes
 *
 * @param {string} data socket.io package from client
 * @returns {Object}      message object
 */
Connector.decode = Connector.prototype.decode = function (msg) {
  let index = 0

  const id = parseIntField(msg, index, PKG_ID_BYTES)
  index += PKG_ID_BYTES

  const routeLen = parseIntField(msg, index, PKG_ROUTE_LENGTH_BYTES)

  const route = msg.substr(PKG_HEAD_BYTES, routeLen)
  const body = msg.substr(PKG_HEAD_BYTES + routeLen)

  return {
    id,
    route,
    body: JSON.parse(body)
  }
}

const composeResponse = (msgId, route, msgBody) => {
  return {
    id: msgId,
    body: msgBody
  }
}

const composePush = (route, msgBody) => {
  return JSON.stringify({ route, body: msgBody })
}

const parseIntField = (str, offset, len) => {
  let res = 0
  for (let i = 0; i < len; i++) {
    if (i > 0) {
      res <<= 8
    }
    res |= str.charCodeAt(offset + i) & 0xff
  }

  return res
}
