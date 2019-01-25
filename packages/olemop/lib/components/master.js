/**
 * Component for master.
 */

const Master = require('../master/master')

/**
 * Master component class
 *
 * @param {Object} app  current application context
 */
class Component {
  constructor(app, opts) {
    this.name = '__master__'
    this.master = new Master(app, opts)
  }

  /**
   * Component lifecycle function
   *
   * @param  {Function} cb
   * @return {Void}
   */
  start (cb) {
    this.master.start(cb)
  }

  /**
   * Component lifecycle function
   *
   * @param  {Boolean}   force whether stop the component immediately
   * @param  {Function}  cb
   * @return {Void}
   */
  stop (force, cb) {
    this.master.stop(cb)
  }
}

/**
 * Component factory function
 *
 * @param  {Object} app  current application context
 * @return {Object}      component instances
 */
module.exports = (app, opts) => {
	return new Component(app, opts)
}
