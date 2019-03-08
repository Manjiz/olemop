const consts = require('../util/const')

/**
 * WebClient is an end-user using a browser
 * @param {*} socket
 * @param {*} server
 */
const WebClient = function (socket, server) {
  this.id = socket.id
  this.socket = socket
  this.logServer = server

  // Join webs room
  socket.join(consts.room.WEBS)

  // Remove WebClient
  socket.on('disconnect', () => {
    socket.leave(consts.room.WEBS)
  })
}

WebClient.prototype = {
  // Tell WebClient to add new Node
  addNode (node) {
    this.socket.emit(consts.event.ADD_NODE, {
      nodeId: node.nodeId,
      iport: node.iport
    })
  },

  // Tell WebClient to remove Node
  removeNode (node) {
    this.socket.emit(consts.event.REMOVE_NODE, {
      node: node.nodeId
    })
  },

  errorNode (node, error) {
    this.socket.emit('error', {
      node: node.iport,
      error
    })
  }
}

module.exports = WebClient
