const io = require('socket.io')
const starter = require('./starter')
const NodeClient = require('./NodeClient')
const WebClient = require('./WebClient')
const logging = require('../common/logging')
const stat  = require('../monitor/stat')
const consts = require('../util/const')

const { event } = consts

const STATUS_INTERVAL = 60 * 1000
const HEARTBEAT_INTERVAL = 30 * 1000
const STATUS_IDLE = 0
const STATUS_READY = 1
const STATUS_RUNNING = 2
const STATUS_DISCONN = 3

/**
 * robot master instance
 *
 * @param {Object} conf = { clients, mainFile }
 *
 * conf.main client run file
 */
const Server = function (conf = {}) {
  this.log = logging
  this.nodes = {}
  this.webClients = {}
  this.conf = conf
  this.runconfig = null
  this.status = STATUS_IDLE

  setInterval(() => {
    this.log.info(`Nodes: ${Object.keys(this.nodes).length}, WebClients: ${Object.keys(this.webClients).length}`)
  }, STATUS_INTERVAL)
}

Server.prototype = {
  listen (port) {
    this.io = io.listen(port, {
      pingInterval: HEARTBEAT_INTERVAL
    })
    this.register()
  },

  /**
   * Registers new Node with Server, announces to WebClients
   */
  announceNode (socket, message) {
    const nodeId = message.nodeId
    if (this.nodes[nodeId]) {
      this.log.warn(`Warning: Node '${nodeId}' already exists, delete old items `)
      socket.emit(event.NODE_ALREADY_EXISTS)
      delete this.nodes[nodeId]
    }

    const node = new NodeClient(nodeId, socket, this)
    this.nodes[nodeId] = node

    Object.values(this.webClients).forEach((webClient) => {
      webClient.addNode(node)
    })

    socket.on('disconnect', () => {
      delete this.nodes[nodeId]
      Object.values(this.webClients).forEach((webClient) => {
        webClient.removeNode(node)
      })
      if (Object.keys(this.nodes).length <= 0) {
        this.status = STATUS_IDLE
      }
      stat.clear(nodeId)
    })

    socket.on('report', (message) => {
      stat.merge(nodeId, message)
    })

    /* temporary code */
    socket.on('error', (message) => {
      Object.values(this.webClients).forEach((webClient) => {
        webClient.errorNode(node, message)
      })
    })

    socket.on('crash', (message) => {
      Object.values(this.webClients).forEach((webClient) => {
        webClient.errorNode(node, message)
      })
      this.status = STATUS_READY
    })
    /* temporary code */
  },

  /**
   * Registers new WebClient with Server
   */
  announceWebClient (socket) {
    const webClient = new WebClient(socket, this)
    this.webClients[webClient.id] = webClient
    Object.values(this.nodes).forEach((node) => {
      webClient.addNode(node)
    })

    setInterval(() => {
      this.io.sockets.in(consts.room.WEBS).emit(event.STATUS_REPORT, { status: this.status })
    }, STATUS_INTERVAL / 10)

    socket.on(event.PULL_WEBREPORT, (message) => {
      if (this.status !== STATUS_RUNNING) return
      socket.emit(event.PUSH_WEBREPORT, this.runconfig.agent, this.runconfig.maxuser, stat.getTimeData(this), stat.getCountData())
    })

    socket.on(event.PULL_DETAILREPORT, (message) => {
      if (this.status !== STATUS_RUNNING) return
      socket.emit(event.PUSH_DETAILREPORT, stat.getDetails())
    })

    socket.on('disconnect', () => {
      delete this.webClients[webClient.id]
    })
  },

  /**
   * Register announcement, disconnect callbacks
   */
  register () {
    this.io.sockets.on('connect', (socket) => {
      socket.on(event.ANNOUNCE_NODE, (message) => {
        this.log.info('Registering new node ' + JSON.stringify(message))
        this.announceNode(socket, message)
      })
      socket.on(event.ANNOUNCE_WEB_CLIENT, (message) => {
        this.log.info('Registering new webClient')
        this.announceWebClient(socket)
        // { agent, maxuser, script }
        socket.on('run', (msg) => {
          stat.clear()
          msg.agent = Object.keys(this.nodes).length
          console.log('server begin notify client to run machine...')
          this.runconfig = msg
          Object.values(this.nodes).forEach((ele, index) => {
            ele.socket.emit(event.AGENT_RUN, { index, ...msg })
          })
          this.status = STATUS_RUNNING
        })
        socket.on('ready', (msg) => {
          console.log('server begin ready client...')
          this.io.sockets.in(consts.room.NODES).emit('disconnect', {})
          stat.clear()
          this.status = STATUS_READY
          this.runconfig = msg
          starter.run(this.conf.mainFile, msg, this.conf.clients)
        })

        socket.on(event.exit4reready, () => {
          Object.values(this.nodes).forEach((obj) => {
            obj.socket.emit(event.exit4reready)
          })
          this.nodes = {}
        })
      })
    })
  }
}

module.exports = Server
