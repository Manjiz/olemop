const EventEmitter = require('events')
const Util = require('util')
const logger = require('@olemop/logger').getLogger('olemop-admin', 'MasterAgent')
const MqttServer = require('../protocol/mqtt/mqttServer')
const MasterSocket = require('./masterSocket')
const protocol = require('../util/protocol')
const utils = require('../util/utils')

const ST_INITED = 1
const ST_STARTED = 2
const ST_CLOSED = 3

const noop = () => {}

/**
 * MasterAgent Constructor
 *
 * @class MasterAgent
 * @constructor
 * @param {Object} opts construct parameter
 *                 opts.consoleService {Object} consoleService
 *                 opts.id             {string} server id
 *                 opts.type           {string} server type, 'master', 'connector', etc.
 *                 opts.socket         {Object} socket-io object
 *                 opts.reqId          {number} reqId add by 1
 *                 opts.callbacks      {Object} callbacks
 *                 opts.state          {number} MasterAgent state
 * @public
 */
class MasterAgent extends EventEmitter {
  constructor(consoleService, { whitelist }) {
    super()
    this.reqId = 1
    this.idMap = {}
    this.msgMap = {}
    this.typeMap = {}
    this.clients = {}
    this.sockets = {}
    this.slaveMap = {}
    this.server = null
    this.callbacks = {}
    this.state = ST_INITED
    this.whitelist = whitelist
    this.consoleService = consoleService
  }

  /**
   * master listen to a port and handle register and request
   *
   * @param {string} port
   * @public
   */
  listen(port, cb = noop) {
    if (this.state > ST_INITED) {
      logger.error('master agent has started or closed.')
      return
    }

    this.state = ST_STARTED
    this.server = new MqttServer()
    this.server.listen(port)
    // this.server = sio.listen(port)
    // this.server.set('log level', 0)

    this.server.on('error', (err) => {
      this.emit('error', err)
      cb(err)
    })

    this.server.once('listening', () => {
      setImmediate(() => cb())
    })

    this.server.on('connection', (socket) => {
      // var id, type, info, registered, username
      const masterSocket = new MasterSocket()
      masterSocket['agent'] = this
      masterSocket['socket'] = socket

      this.sockets[socket.id] = socket

      // register a new connection
      socket.on('register', (msg) => masterSocket.onRegister(msg))

      // message from monitor
      socket.on('monitor', (msg) => masterSocket.onMonitor(msg))

      // message from client
      socket.on('client', (msg) => masterSocket.onClient(msg))
      socket.on('reconnect', (msg) => masterSocket.onReconnect(msg))
      socket.on('disconnect', () => masterSocket.onDisconnect())
      socket.on('close', () => masterSocket.onDisconnect())
      socket.on('error', (err) => masterSocket.onError(err))
    })
  }

  /**
   * close master agent
   *
   * @public
   */
  close() {
    if (this.state > ST_STARTED) return
    this.state = ST_CLOSED
    this.server.close()
  }

  /**
   * set module
   *
   * @param {string} moduleId module id/name
   * @param {Object} value module object
   * @public
   */
  set(moduleId, value) {
    this.consoleService.set(moduleId, value)
  }

  /**
   * get module
   *
   * @param {string} moduleId module id/name
   * @public
   */
  get(moduleId) {
    return this.consoleService.get(moduleId)
  }

  /**
   * getClientById
   *
   * @param {string} clientId
   * @public
   */
  getClientById(clientId) {
    return this.clients[clientId]
  }

  /**
   * request monitor{master node} data from monitor
   *
   * @param {string} serverId
   * @param {string} moduleId module id/name
   * @param {Object} msg
   * @param {Function} cb
   * @public
   */
  request(serverId, moduleId, msg, cb = noop) {
    if (this.state > ST_STARTED) {
      return false
    }

    const curId = this.reqId++
    this.callbacks[curId] = cb

    if (!this.msgMap[serverId]) {
      this.msgMap[serverId] = {}
    }

    this.msgMap[serverId][curId] = { moduleId, msg }

    const record = this.idMap[serverId]
    if (!record) {
      cb(new Error('unknown server id: ' + serverId))
      return false
    }

    sendToMonitor(record.socket, curId, moduleId, msg)

    return true
  }

  /**
   * request server data from monitor by serverInfo{host:port}
   *
   * @param {string} serverId
   * @param {Object} serverInfo
   * @param {string} moduleId module id/name
   * @param {Object} msg
   * @param {Function} cb
   * @public
   */
  requestServer(serverId, serverInfo, moduleId, msg, cb) {
    if (this.state > ST_STARTED) {
      return false
    }

    const record = this.idMap[serverId]
    if (!record) {
      utils.invokeCallback(cb, new Error('unknown server id: ' + serverId))
      return false
    }

    const curId = this.reqId++
    this.callbacks[curId] = cb

    if (utils.compareServer(record, serverInfo)) {
      sendToMonitor(record.socket, curId, moduleId, msg)
    } else {
      const slaves = this.slaveMap[serverId]
      for (let i = 0; i < slaves.length; i++) {
        if (utils.compareServer(slaves[i], serverInfo)) {
          sendToMonitor(slaves[i].socket, curId, moduleId, msg)
          break
        }
      }
    }

    return true
  }

  /**
   * notify a monitor{master node} by id without callback
   *
   * @param {string} serverId
   * @param {string} moduleId module id/name
   * @param {Object} msg
   * @public
   */
  notifyById(serverId, moduleId, msg) {
    if (this.state > ST_STARTED) {
      return false
    }

    const record = this.idMap[serverId]
    if (!record) {
      logger.error('fail to notifyById for unknown server id: ' + serverId)
      return false
    }

    sendToMonitor(record.socket, null, moduleId, msg)

    return true
  }

  /**
   * notify a monitor by server{host:port} without callback
   *
   * @param {string} serverId
   * @param {Object} serverInfo{host:port}
   * @param {string} moduleId module id/name
   * @param {Object} msg
   * @public
   */
  notifyByServer(serverId, serverInfo, moduleId, msg) {
    if (this.state > ST_STARTED) {
      return false
    }

    const record = this.idMap[serverId]
    if (!record) {
      logger.error('fail to notifyByServer for unknown server id: ' + serverId)
      return false
    }

    if (utils.compareServer(record, serverInfo)) {
      sendToMonitor(record.socket, null, moduleId, msg)
    } else {
      const slaves = this.slaveMap[serverId]
      for (let i = 0; i < slaves.length; i++) {
        if (utils.compareServer(slaves[i], serverInfo)) {
          sendToMonitor(slaves[i].socket, null, moduleId, msg)
          break
        }
      }
    }
    return true
  }

  /**
   * notify slaves by id without callback
   *
   * @param {string} serverId
   * @param {string} moduleId module id/name
   * @param {Object} msg
   * @public
   */
  notifySlavesById(serverId, moduleId, msg) {
    if (this.state > ST_STARTED) {
      return false
    }

    const slaves = this.slaveMap[serverId]
    if (!slaves || slaves.length === 0) {
      logger.error('fail to notifySlavesById for unknown server id: ' + serverId)
      return false
    }

    broadcastMonitors(slaves, moduleId, msg)
    return true
  }

  /**
   * notify monitors by type without callback
   *
   * @param {string} type serverType
   * @param {string} moduleId module id/name
   * @param {Object} msg
   * @public
   */
  notifyByType(type, moduleId, msg) {
    if (this.state > ST_STARTED) {
      return false
    }

    const list = this.typeMap[type]
    if (!list || list.length === 0) {
      logger.error('fail to notifyByType for unknown server type: ' + type)
      return false
    }
    broadcastMonitors(list, moduleId, msg)
    return true
  }

  /**
   * notify all the monitors without callback
   *
   * @param {string} moduleId module id/name
   * @param {Object} msg
   * @public
   */
  notifyAll(moduleId, msg) {
    if (this.state > ST_STARTED) {
      return false
    }
    broadcastMonitors(this.idMap, moduleId, msg)
    return true
  }

  /**
   * notify a client by id without callback
   *
   * @param {string} clientId
   * @param {string} moduleId module id/name
   * @param {Object} msg
   * @public
   */
  notifyClient(clientId, moduleId, msg) {
    if (this.state > ST_STARTED) {
      return false
    }

    const record = this.clients[clientId]
    if (!record) {
      logger.error('fail to notifyClient for unknown client id: ' + clientId)
      return false
    }
    sendToClient(record.socket, null, moduleId, msg)
  }

  notifyCommand(command, moduleId, msg) {
    if (this.state > ST_STARTED) {
      return false
    }
    broadcastCommand(this.idMap, command, moduleId, msg)
    return true
  }

  doAuthUser(msg, socket, cb) {
    if (!msg.id) {
      // client should has a client id
      return cb(new Error('client should has a client id'))
    }

    const username = msg.username
    if (!username) {
      // client should auth with username
      doSend(socket, 'register', {
        code: protocol.PRO_FAIL,
        msg: 'client should auth with username'
      })
      return cb(new Error('client should auth with username'))
    }

    const { authUser, env } = this.consoleService.authUser
    authUser(msg, env, (user) => {
      if (!user) {
        // client should auth with username
        doSend(socket, 'register', {
          code: protocol.PRO_FAIL,
          msg: 'client auth failed with username or password error'
        })
        return cb(new Error('client auth failed with username or password error'))
      }

      if (this.clients[msg.id]) {
        doSend(socket, 'register', {
          code: protocol.PRO_FAIL,
          msg: 'id has been registered. id: ' + msg.id
        })
        return cb(new Error('id has been registered. id: ' + msg.id))
      }

      logger.info(`client user: ${username} login to master`)
      addConnection(this, msg.id, msg.type, null, user, socket)
      doSend(socket, 'register', {
        code: protocol.PRO_OK,
        msg: 'ok'
      })

      cb()
    })
  }

  doAuthServer(msg, socket, cb) {
    const { authServer, env } = this.consoleService
    authServer(msg, env, (status) => {
      if (status !== 'ok') {
        doSend(socket, 'register', {
          code: protocol.PRO_FAIL,
          msg: 'server auth failed'
        })
        cb(new Error('server auth failed'))
        return
      }

      const record = addConnection(this, msg.id, msg.serverType, msg.pid, msg.info, socket)

      doSend(socket, 'register', {
        code: protocol.PRO_OK,
        msg: 'ok'
      })
      msg.info = msg.info || {}
      msg.info.pid = msg.pid
      this.emit('register', msg.info)
      cb(null)
    })
  }
}

/**
 * add monitor,client to connection -- idMap
 *
 * @param {Object} agent agent object
 * @param {string} id
 * @param {string} type serverType
 * @param {Object} socket socket-io object
 * @private
 */
const addConnection = (agent, id, type, pid, info, socket) => {
  const record = { id, type, pid, info, socket }
  if (type === 'client') {
    agent.clients[id] = record
  } else {
    if (!agent.idMap[id]) {
      agent.idMap[id] = record
      const list = agent.typeMap[type] = agent.typeMap[type] || []
      list.push(record)
    } else {
      const slaves = agent.slaveMap[id] = agent.slaveMap[id] || []
      slaves.push(record)
    }
  }
  return record
}

/**
 * remove monitor,client connection -- idMap
 *
 * @param {Object} agent agent object
 * @param {string} id
 * @param {string} type serverType
 * @private
 */
const removeConnection = (agent, id, type, info) => {
  if (type === 'client') {
    delete agent.clients[id]
  } else {
    // remove master node in idMap and typeMap
    const record = agent.idMap[id]
    if (!record) return
    // info { host, port }
    const _info = record['info']
    if (utils.compareServer(_info, info)) {
      delete agent.idMap[id]
      const list = agent.typeMap[type]
      if (list) {
        for (let i = 0; i < list.length; i++) {
          if (list[i].id === id) {
            list.splice(i, 1)
            break
          }
        }
        if (list.length === 0) {
          delete agent.typeMap[type]
        }
      }
    } else {
      // remove slave node in slaveMap
      const slaves = agent.slaveMap[id]
      if (slaves) {
        for (let i = 0; i < slaves.length; i++) {
          if (utils.compareServer(slaves[i]['info'], info)) {
            slaves.splice(i, 1)
            break
          }
        }
        if (slaves.length === 0) {
          delete agent.slaveMap[id]
        }
      }
    }
  }
}

/**
 * send msg to monitor
 *
 * @param {Object} socket socket-io object
 * @param {number} reqId request id
 * @param {string} moduleId module id/name
 * @param {Object} msg message
 * @private
 */
const sendToMonitor = (socket, reqId, moduleId, msg) => {
  doSend(socket, 'monitor', protocol.composeRequest(reqId, moduleId, msg))
}

/**
 * send msg to client
 *
 * @param {Object} socket socket-io object
 * @param {number} reqId request id
 * @param {string} moduleId module id/name
 * @param {Object} msg message
 * @private
 */
const sendToClient = (socket, reqId, moduleId, msg) => {
  doSend(socket, 'client', protocol.composeRequest(reqId, moduleId, msg))
}

const doSend = (socket, topic, msg) => {
  socket.send(topic, msg)
}

/**
 * broadcast msg to monitor
 *
 * @param {Object} record registered modules
 * @param {string} moduleId module id/name
 * @param {Object} msg message
 * @private
 */
const broadcastMonitors = (records, moduleId, msg) => {
  msg = protocol.composeRequest(null, moduleId, msg)

  if (records instanceof Array) {
    for (var i = 0, l = records.length; i < l; i++) {
      var socket = records[i].socket
      doSend(socket, 'monitor', msg)
    }
  } else {
    for (var id in records) {
      var socket = records[id].socket
      doSend(socket, 'monitor', msg)
    }
  }
}

var broadcastCommand = function (records, command, moduleId, msg) {
  msg = protocol.composeCommand(null, command, moduleId, msg)

  if (records instanceof Array) {
    for (var i = 0, l = records.length; i < l; i++) {
      var socket = records[i].socket
      doSend(socket, 'monitor', msg)
    }
  } else {
    for (var id in records) {
      var socket = records[id].socket
      doSend(socket, 'monitor', msg)
    }
  }
}

MasterAgent.prototype.doSend = doSend

MasterAgent.prototype.sendToMonitor = sendToMonitor

MasterAgent.prototype.addConnection = addConnection

MasterAgent.prototype.removeConnection = removeConnection

module.exports = MasterAgent
