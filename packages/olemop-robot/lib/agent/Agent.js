const io = require('socket.io-client')
const Actor = require('./Actor')
const logging = require('../common/logging')
const monitor  = require('../monitor/monitor')
const util = require('../common/util')
const consts = require('../util/const')

const STATUS_INTERVAL = 10 * 1000
const RECONNECT_INTERVAL = 10 * 1000
const HEARTBEAT_PERIOD = 30 * 1000
const HEARTBEAT_FAILS = 3

/**
 * init the master and app server for the agent
 * include app data, exec script,etc.
 *
 * @param {Object} conf = { master, script }
 */
class Agent {
  constructor (conf) {
    this.log = logging
    this.conf = conf
    this.lastHeartbeatTime = null
    this.connected = false
    this.reconnecting = false
    this.actors = {}
    this.count = 0
  }

  /**
   * Run agent
   */
  start () {
    this.connect()
    // Check for heartbeat every HEARTBEAT_PERIOD, reconnect if necessary
    setInterval(() => {
      const delta = Date.now() - this.lastHeartbeatTime
      if (delta > HEARTBEAT_PERIOD * HEARTBEAT_FAILS) {
        this.log.warn('Failed heartbeat check, reconnecting...')
        this.connected = false
        this.reconnect()
      }
    }, HEARTBEAT_PERIOD)
  }

  /**
   * Create socket, bind callbacks, connect to server
   */
  connect () {
    const uri = `ws://${this.conf.master.host}:${this.conf.master.port}`
    this.socket = io.connect(uri, {
      // 'force new connection': true,
      forceNew: true,
      // 'try multiple transports': false
    })
    this.socket.on('error', (reason) => {
      this.reconnect()
    })
    // Register announcement callback
    this.socket.on('connect', () => {
      this.log.info('Connected to server, sending announcement...')
      // console.log(this.socket.socket.sessionid)
      // console.log(require('util').inspect(this.socket.address, true, 10, 10))
      this.announce()
      this.connected = true
      this.reconnecting = false
      this.lastHeartbeatTime = Date.now()
    })

    this.socket.on('disconnect', () => {
      // @todo 这句没用的吧
      this.socket.disconnect()
      this.log.error('Disconnect...')
    })

    // Server heartbeat
    this.socket.on('pong', () => {
      this.lastHeartbeatTime = Date.now()
    })

    // Node with same label already exists on server, kill process
    this.socket.on(consts.event.NODE_ALREADY_EXISTS, () => {
      this.log.error('ERROR: A node of the same name is already registered')
      this.log.error('with the log server. Change this agent\'s instance_name.')
      this.log.error('Exiting.')
      process.exit(1)
    })

    // begin to run
    this.socket.on(consts.event.AGENT_RUN, (message) => {
      this.run(message)
    })

    // Exit for BTN_ReReady
    this.socket.on(consts.event.exit4reready, () => {
      this.log.info('Exit for BTN_ReReady.')
      process.exit(0)
    })
  }

  run ({ maxuser, script, index }) {
    util.deleteLog()
    this.count = maxuser
    if (script && script.length > 1) {
      this.conf.script = script
    }
    this.log.info(`${this.nodeId} run ${this.count} actors `)
    monitor.clear()
    this.actors = {}
    const offset = index * this.count
    for (let i = 0; i < this.count; i++) {
      // calc database key offset
      const aid = i + offset
      const actor = new Actor(this.conf, aid)
      this.actors[aid]= actor

      actor.on('error', (error) => {
        this.socket.emit('error', error)
      })

      const vmParams = this.conf.apps[i]
      if (this.conf.master.interval <= 0) {
        actor.run(vmParams)
      } else {
        const time = Math.round(Math.random() * 1000 + i * this.conf.master.interval)
        setTimeout(() => {
          actor.run(vmParams)
        }, time)
      }
    }
    setInterval(() => {
      this.socket.emit('report', monitor.getData())
    }, STATUS_INTERVAL)
  }

  /**
   * Sends announcement
   */
  announce () {
    const sessionid = this.socket.id
    this.nodeId = sessionid
    this._send(consts.event.ANNOUNCE_NODE, {
      clientType: 'node',
      nodeId: sessionid
    })
  }

  /**
   * Reconnect helper, retry until connection established
   */
  reconnect (force) {
    if (!force && this.reconnecting) return
    this.reconnecting = true
    if (this.socket) {
      this.socket.disconnect()
      this.connected = false
    }
    this.log.info('Reconnecting to server...')
    setTimeout(() => {
      if (this.connected) return
      this.connect()
    }, RECONNECT_INTERVAL)
  }

  _send (event, message) {
    try {
      this.socket.emit(event, message)
      // If server is down, a non-writeable stream error is thrown.
    } catch (err) {
      this.log.error('ERROR: Unable to send message over socket.')
      this.connected = false
      this.reconnect()
    }
  }
}

module.exports = Agent
