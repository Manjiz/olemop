/**
 * Condition node.
 *
 * @param opts {Object}
 *        opts.blackboard {Object} blackboard object
 *        opts.cond(blackboard) {Function} condition callback. Return true or false to decide the node return success or fail.
 * @returns {number}
 *          bt.RES_SUCCESS if cond callback return true;
 *          bt.RES_FAIL if cond undefined or return false.
 */

const bt = require('../bt')
const Node = require('./Node')

class Condition extends Node {
  constructor (opts) {
    super(opts.blackboard)
    this.cond = opts.cond
  }

  doAction () {
    // @todo 存疑
    if (this.cond && this.cond.call(null, this.blackboard)) {
      return bt.RES_SUCCESS
    }
    return bt.RES_FAIL
  }
}

module.exports = Condition
