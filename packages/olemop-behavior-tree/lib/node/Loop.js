/**
 * Loop node: a decorator node that invoke child in loop.
 *
 * @param opts {Object}
 *        opts.blackboard {Object} blackboard object
 *        opts.child {Object} origin action that is decorated
 *        opts.loopCond(blackboard) {Function} loop condition callback. Return true to continue the loop.
 * @returns {number}
 *          bt.RES_SUCCESS if loop finished successfully
 *          bt.RES_FAIL and break loop if child return fail
 *          bt.RES_WAIT if child return wait or loop is continue.
 */

const bt = require('../bt')
const Decorator = require('./Decorator')

class Loop extends Decorator {
  constructor (opts) {
    super(opts.blackboard, opts.child)
    this.loopCond = opts.loopCond
  }

  doAction () {
    const res = this.child.doAction()
    if (res !== bt.RES_SUCCESS) return res
    if (this.loopCond && this.loopCond.call(null, this.blackboard)) {
      // wait next tick
      return bt.RES_WAIT
    }
    return bt.RES_SUCCESS
  }
}

module.exports = Loop
