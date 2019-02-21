/**
 * Component for server starup.
 */

const Server = require('../server/server')

/**
 * Server component class
 *
 * @param {Object} app  current application context
 */
class Component {
  constructor(app, opts) {
    this.name = '__server__'
    this.server = Server.create(app, opts)
  }

  /**
   * Component lifecycle callback
   *
   * @param {Function} cb
   */
  start (cb) {
    this.server.start()
    process.nextTick(cb)
  }

  /**
   * Component lifecycle callback
   *
   * @param {Function} cb
   */
  afterStart (cb) {
    this.server.afterStart()
    process.nextTick(cb)
  }

  /**
   * Component lifecycle function
   *
   * @param {boolean}  force whether stop the component immediately
   * @param {Function}  cb
   */
  stop (force, cb) {
    this.server.stop()
    process.nextTick(cb)
  }

  /**
   * Proxy server handle
   */
  handle (msg, session, cb) {
    this.server.handle(msg, session, cb)
  }

  /**
   * Proxy server global handle
   */
  globalHandle (msg, session, cb) {
    this.server.globalHandle(msg, session, cb)
  }
}

/**
 * Component factory function
 *
 * @param {Object} app  current application context
 * @returns {Object}     component instance
 */
module.exports = (app, opts) => {
	return new Component(app, opts)
}
