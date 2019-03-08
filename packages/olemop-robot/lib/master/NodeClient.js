const consts = require('../util/const')

/**
 * NodeClient is a server/machine/instance running a agent socket
 * @param {*} nodeId
 * @param {*} socket
 * @param {*} server
 */
const NodeClient = function (nodeId, socket, server) {
  this.id = socket.id
  this.nodeId = nodeId
  this.socket = socket
  this.logServer = server
  // this.iport = `${socket.handshake.address}:${socket.handshake.address.port}`
  this.iport = `${socket.request.connection.remoteAddress}:${socket.request.connection.remotePort}`

  // Join 'nodes' room
  socket.join(consts.room.NODES)

  socket.on('disconnect', () => {
    // Notify all WebClients upon disconnect
    Object.values(this.logServer.webClients).forEach((webClient) => {
      webClient.removeNode(this)
    })
    socket.leave(consts.room.NODES)
  })
}

module.exports = NodeClient
