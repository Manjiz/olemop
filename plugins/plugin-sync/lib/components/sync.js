/**
 * Component for data sync.
 */

const DataSync = require('@olemop/sync')

let instance = null

/**
 * Sync states
 */
// sync has started
const STATE_STARTED = 1
// sync has stoped
const STATE_STOPED  = 2

/**
 * Init sync
 *
 * @param {Object} opts contructor parameters for DataSync
 * @return {Object} DataSync Object
 */
const createSync = (opts = {}) => {
  opts.mappingPath = opts.path
  opts.client = opts.dbclient
  opts.interval = opts.interval || 60 * 1000
  return new DataSync(opts)
}

/**
 * Sync component class
 *
 * @param {Object} app  current application context
 * @param {Object} opts construct parameters
 */
class Component {
  constructor(app, opts) {
    this.app = app
    this.sync = createSync(opts)
    this.dbclient = opts.dbclient
    this.state = STATE_STARTED
  }

  /**
   * stop the component
   *
   * @param {boolean} force,true or false
   * @param {Function} cb, callback
   */
  stop(force, cb) {
    const self = this
    if (this.state > STATE_STARTED) {
      cb()
      return
    }
    this.state = STATE_STOPED
    this.sync.sync()
    const interval = setInterval(() => {
      if (self.sync.isDone()) {
        clearInterval(interval)
        cb()
      }
    }, 200)
  }
}

/**
 * Component factory function
 *
 * @param {Object} app  current application context
 * @param {Object} opts construct parameters
 * @return {Object}     component instances
 */
module.exports = function (app, opts) {
  // this should be singleton
  if (instance) return instance

  if (!opts || !opts.dbclient) throw new Error('opts.dbclient should not be empty.')

  if (!opts.path) throw new Error('opts.path should not be empty.')

  instance = new Component(app, opts)
  app.set('sync', instance.sync)
  return instance
}
