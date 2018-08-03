/**
 * If node: invoke the action if the condition is true
 *
 * @param opts {Object}
 *        opts.blackboard {Object} blackboard
 *        opts.action {Node} action that would be invoked if cond return true
 *        opts.cond(blackboard) {Function} condition callback, return true or false.
 */

const Node = require('./Node')
const Condition = require('./Condition')
const Sequence = require('./Sequence')

class If extends Node {
  constructor (opts) {
    super(opts.blackboard)
    this.action = new Sequence({ blackboard: opts.blackboard })
    const condition = new Condition({ blackboard: opts.blackboard, cond: opts.cond })
    this.action.addChild(condition)
    this.action.addChild(opts.action)
  }

  /**
   * Move the current mob into patrol module and remove it from ai module.
   *
   * @return {Number} ai.RES_SUCCESS if everything ok;
   *                  ai.RES_FAIL if any error.
   */
  doAction () {
    return this.action.doAction()
  }
}

module.exports = If
