/**
 * Parallel node: a parent node that would invoke children in parallel.
 * The node would wait for all the children finished and return the result.
 * The result value would be decided by the policy.
 * POLICY_FAIL_ON_ONE stands for return fail if any fails
 * POLICY_FAIL_ON_ALL stands for return fail if and only if all fail.
 */

const bt = require('../bt')
const Composite = require('./Composite')

class Parallel extends Composite {
  constructor (opts) {
    super(opts.blackboard)
    this.policy = opts.policy || Node.POLICY_FAIL_ON_ONE
    this.waits = []
    this.succ = 0
    this.fail = 0
  }

  static get POLICY_FAIL_ON_ONE () { return 0 }
  static get POLICY_FAIL_ON_ALL () { return 1 }

  doAction () {
    if (!this.children.length) return bt.RES_SUCCESS
    let res
    const rest = []
    const origin = this.waits.length ? this.waits : this.children

    // iterate all the children and record the results
    for (let i = 0; i < origin.length; i++) {
      res = origin[i].doAction()
      switch (res) {
        case bt.RES_SUCCESS:
          this.succ++
          break
        case bt.RES_WAIT:
          rest.push(origin[i])
          break
        default:
          this.fail++
          break
      }
    }

    if (rest.length) {
      // return wait if any in wait
      this.waits = rest
      return bt.RES_WAIT
    }

    // check the result if all have finished
    res = this.checkPolicy()
    this.reset()
    return res
  }

  /**
   * reset the node state
   */
  reset () {
    this.waits.length = 0
    this.succ = 0
    this.fail = 0
  }

  /**
   * check current state with policy
   * @return {number} ai.RES_SUCCESS for success and ai.RES_FAIL for fail
   */
  checkPolicy () {
    if (this.policy === Parallel.POLICY_FAIL_ON_ONE) {
      return this.fail ? bt.RES_FAIL : bt.RES_SUCCESS
    }
    if (this.policy === Parallel.POLICY_FAIL_ON_ALL) {
      return this.succ ? bt.RES_SUCCESS : bt.RES_FAIL
    }
  }
}

module.exports = Parallel
