/**
 * Decorator node: parent of nodes that decorate other node.
 */

const Node = require('./Node')

class Decorator extends Node {
  constructor (blackboard, child) {
    super(blackboard)
    this.child = child
  }

  /**
   * set the child fo the node
   */
  setChild (node) {
    this.child = node
  }
}

module.exports = Decorator
