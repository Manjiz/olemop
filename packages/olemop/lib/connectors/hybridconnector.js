/**
 * Connector that manager low level connection and protocol bewteen server and client.
 * Develper can provide their own connector to switch the low level prototol, such as tcp or probuf.
 *
 * if (!(this instanceof Connector)) {
 *   return new Connector(port, host, opts)
 * }
 */

const net = require('net')
const tls = require('tls')
const EventEmitter = require('events')

const HybridSocket = require('./hybridsocket')
const Switcher = require('./hybrid/switcher')
const Handshake = require('./commands/handshake')
const Heartbeat = require('./commands/heartbeat')
const Kick = require('./commands/kick')
const coder = require('./common/coder')

let curId = 1

class HybridConnector extends EventEmitter {
  constructor (port, host, opts = {}) {
    super()
    this.opts = opts
    this.port = port
    this.host = host
    this.useDict = opts.useDict
    this.useProtobuf = opts.useProtobuf
    this.handshake = new Handshake(opts)
    this.heartbeat = new Heartbeat(opts)
    this.distinctHost = opts.distinctHost
    this.ssl = opts.ssl

    this.switcher = null

    this.encode = coder.encode
    this.decode = coder.decode
  }

  /**
   * Start connector to listen the specified port
   */
  start (cb) {
    const app = require('../olemop').app

    const gensocket = (socket) => {
      const hybridsocket = new HybridSocket(curId++, socket)
      hybridsocket.on('handshake', this.handshake.handle.bind(this.handshake, hybridsocket))
      hybridsocket.on('heartbeat', this.heartbeat.handle.bind(this.heartbeat, hybridsocket))
      hybridsocket.on('disconnect', this.heartbeat.clear.bind(this.heartbeat, hybridsocket.id))
      hybridsocket.on('closing', Kick.handle.bind(null, hybridsocket))
      this.emit('connection', hybridsocket)
    }

    this.connector = app.components.__connector__.connector
    this.dictionary = app.components.__dictionary__
    this.protobuf = app.components.__protobuf__

    if (!this.ssl) {
      this.listeningServer = net.createServer()
    } else {
      this.listeningServer = tls.createServer(this.ssl)
    }
    this.switcher = new Switcher(this.listeningServer, this.opts)

    this.switcher.on('connection', (socket) => {
      gensocket(socket)
    })

    if (this.distinctHost) {
      this.listeningServer.listen(this.port, this.host)
    } else {
      this.listeningServer.listen(this.port)
    }

    process.nextTick(cb)
  }

  stop (force, cb) {
    this.switcher.close()
    this.listeningServer.close()

    process.nextTick(cb)
  }
}

HybridConnector.encode = coder.encode
HybridConnector.decode = coder.decode

module.exports = HybridConnector
