/**
 * Sequence node: a parent node that would invoke children one by one.
 * Return success if only if all the children return true.
 * It would break the iteration and reset states if any child fail.
 * It would return the wait state directly to parent and keep all the states if a child return wait
 */

const bt = require('../bt')
const Composite = require('./Composite')

class Sequence extends Composite {
  constructor (opts) {
    super(opts.blackboard)
    this.index = 0
  }

  doAction () {
    if (!this.children.length) return bt.RES_SUCCESS
    if (this.index >= this.children.length) {
      this.reset()
    }

    let res
    for (; this.index < this.children.length; this.index++) {
      res = this.children[this.index].doAction()
      if (res === bt.RES_SUCCESS) {
        continue
      } else if (res === bt.RES_WAIT) {
        // return to parent directly if wait
        return res
      } else {
        // reset state and return fail
        this.reset()
        return res
      }
    }
    // we will return success if all children success
    this.reset()
    return bt.RES_SUCCESS
  }

  reset () {
    this.index = 0
  }
}

module.exports = Sequence
