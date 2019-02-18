const http = require('http')
const EventEmitter = require('events')
const WebSocket = require('ws')

const ST_STARTED = 1
const ST_CLOSED = 2

/**
 * websocket protocol processor
 */
class WSProcessor extends EventEmitter {
  constructor() {
    super()
    this.httpServer = http.createServer()

    this.wsServer = new WebSocket.Server({ server: this.httpServer })

    this.wsServer.on('connection', (socket) => {
      // emit socket to outside
      this.emit('connection', socket)
    })

    this.state = ST_STARTED
  }

  add(socket, data) {
    if (this.state !== ST_STARTED) return
    this.httpServer.emit('connection', socket)
    if (typeof socket.ondata === 'function') {
      // compatible with stream2
      socket.ondata(data, 0, data.length)
    } else {
      // compatible with old stream
      socket.emit('data', data)
    }
  }

  close() {
    if (this.state !== ST_STARTED) return
    this.state = ST_CLOSED
    this.wsServer.close()
    this.wsServer = null
    this.httpServer = null
  }
}

module.exports = WSProcessor
