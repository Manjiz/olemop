const EventEmitter = require('events')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const WSProcessor = require('./wsprocessor')
const TCPProcessor = require('./tcpprocessor')

const HTTP_METHODS = [
  'GET', 'POST', 'DELETE', 'PUT', 'HEAD'
]

const ST_STARTED = 1
const ST_CLOSED = 2

const DEFAULT_TIMEOUT = 90

/**
 * Switcher for tcp and websocket protocol
 *
 * @param {Object} server tcp server instance from node.js net module
 */
class Switcher extends EventEmitter {
  constructor (server, opts) {
    super()
    this.server = server
    this.wsprocessor = new WSProcessor()
    this.tcpprocessor = new TCPProcessor(opts.closeMethod)
    this.id = 1
    this.timeout = (opts.timeout || DEFAULT_TIMEOUT) * 1000
    this.setNoDelay = opts.setNoDelay

    if (!opts.ssl) {
      this.server.on('connection', this.newSocket.bind(this))
    } else {
      this.server.on('secureConnection', this.newSocket.bind(this))
      this.server.on('clientError', (e, tlsSo) => {
        logger.warn('an ssl error occured before handshake established: ', e)
        tlsSo.destroy()
      })
    }

    this.wsprocessor.on('connection', this.emit.bind(this, 'connection'))
    this.tcpprocessor.on('connection', this.emit.bind(this, 'connection'))

    this.state = ST_STARTED
  }

  static isHttp (data) {
    const head = data.toString('utf8', 0, 4)

    for (let i = 0; i < HTTP_METHODS.length; i++) {
      if (head.indexOf(HTTP_METHODS[i]) === 0) {
        return true
      }
    }

    return false
  }

  static processHttp (switcher, processor, socket, data) {
    processor.add(socket, data)
  }

  static processTcp (switcher, processor, socket, data) {
    processor.add(socket, data)
  }

  newSocket (socket) {
    if (this.state !== ST_STARTED) return

    socket.setTimeout(this.timeout, () => {
       logger.warn('connection is timeout without communication, the remote ip is %s && port is %s',
         socket.remoteAddress, socket.remotePort)
       socket.destroy()
    })

    socket.once('data', (data) => {
      // @todo FIXME: handle incomplete HTTP method
      if (Switcher.isHttp(data)) {
        Switcher.processHttp(this, this.wsprocessor, socket, data)
      } else {
        if (this.setNoDelay) {
          socket.setNoDelay(true)
        }
        Switcher.processTcp(this, this.tcpprocessor, socket, data)
      }
    })
  }

  close () {
    if (this.state !== ST_STARTED) return

    this.state = ST_CLOSED
    this.wsprocessor.close()
    this.tcpprocessor.close()
  }
}

module.exports = Switcher
