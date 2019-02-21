/**
 * Component for monitor.
 * Load and start monitor client.
 */

const Monitor = require('../monitor/monitor')

class MonitorComponent {
  constructor(app, opts) {
    this.name = '__monitor__'
    this.monitor = new Monitor(app, opts)
  }

  start (cb) {
    this.monitor.start(cb)
  }

  stop (force, cb) {
    this.monitor.stop(cb)
  }

  reconnect (masterInfo) {
    this.monitor.reconnect(masterInfo)
  }
}

/**
 * Component factory function
 *
 * @param  {Object} app  current application context
 * @returns {Object}      component instances
 */
module.exports = (app, opts) => {
  return new MonitorComponent(app, opts)
}
