/**
 * Composite node: parent of nodes that have multi-children.
 */

const Node = require('./Node')

class Composite extends Node {
  constructor (blackboard) {
    super(blackboard)
    this.blackboard = blackboard
    this.children = []
  }

  /**
   * Add a child to the node
   */
  addChild (node) {
    this.children.push(node)
  }
}

module.exports = Composite
