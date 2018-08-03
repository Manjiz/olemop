/**
 * Select node: a parent node that would invoke children one by one.
 * Return success and reset state if one child return success.
 * Return fail if all children fail.
 * Return wait and hold state if one child return wait.
 */

const bt = require('../bt')
const Composite = require('./Composite')

class Select extends Composite {
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
        this.reset()
        return res
      } else if (res === bt.RES_WAIT) {
        //return to parent directly if wait
        return res
      } else {
        //try next if fail
        continue
      }
    }
    //we will return success if all children success
    this.reset()
    return bt.RES_FAIL
  }

  reset () {
    this.index = 0
  }
}

module.exports = Select
