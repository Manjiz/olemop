/**
 * Process heartbeat request.
 *
 * @param {Object} opts option request
 *                      opts.heartbeat heartbeat interval
 */

const Package = require('@olemop/protocol').Package
const olemopLogger = require('@olemop/logger')

const logger = olemopLogger.getLogger('olemop', __filename)

class Heartbeat {
  constructor (opts = {}) {
    this.heartbeat = null
    this.timeout = null
    this.disconnectOnTimeout = opts.disconnectOnTimeout

    if (opts.heartbeat) {
      // heartbeat interval
      this.heartbeat = opts.heartbeat * 1000
      // max heartbeat message timeout
      this.timeout = opts.timeout * 1000 || this.heartbeat * 2
      this.disconnectOnTimeout = true
    }

    this.timeouts = {}
    this.clients = {}
  }

  static clearTimers (self, id) {
    delete self.clients[id]
    const tid = self.timeouts[id]
    if (!tid) return
    clearTimeout(tid)
    delete self.timeouts[id]
  }

  handle (socket) {
    if (!this.heartbeat) return

    if (!this.clients[socket.id]) {
      // clear timers when socket disconnect or error
      this.clients[socket.id] = 1
      socket.once('disconnect', Heartbeat.clearTimers.bind(null, this, socket.id))
      socket.once('error', Heartbeat.clearTimers.bind(null, this, socket.id))
    }

    // clear timeout timer
    if (this.disconnectOnTimeout) {
      this.clear(socket.id)
    }

    socket.sendRaw(Package.encode(Package.TYPE_HEARTBEAT))

    if (this.disconnectOnTimeout) {
      this.timeouts[socket.id] = setTimeout(() => {
        logger.info('client %j heartbeat timeout.', socket.id)
        socket.disconnect(1001, 'server side heartbeat timeout')
      }, this.timeout)
    }
  }

  clear (id) {
    const tid = this.timeouts[id]
    if (!tid) return
    clearTimeout(tid)
    delete this.timeouts[id]
  }
}

module.exports = Heartbeat
