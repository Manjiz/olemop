/**
 * MasterSocket
 *
 * onRegister
 * onMonitor
 * onClient
 * onReconnect
 * onDisconnect
 * repushQosMessage
 * onError
 */

const logger = require('@olemop/logger').getLogger('olemop-admin', 'MasterSocket')
const Constants = require('../util/constants')
const protocol = require('../util/protocol')

class MasterSocket {
  constructor() {
    this.id = null
    this.type = null
    this.info = null
    this.agent = null
    this.socket = null
    this.username = null
    this.registered = false
  }

  onRegister(msg) {
    if (!msg || !msg.type) return

    const { id: serverId, type: serverType } = msg

    if (serverType == Constants.TYPE_CLIENT) {
      // client connection not join the map
      this.id = serverId
      this.type = serverType
      this.info = 'client'
      this.agent.doAuthUser(msg, this.socket, (err) => {
        if (err) {
          return this.socket.disconnect()
        }

        this.username = msg.username
        this.registered = true
      })
      return
    }

    if (serverType == Constants.TYPE_MONITOR) {
      if (!serverId) return

      // if is a normal server
      this.id = serverId
      this.type = msg.serverType
      this.info = msg.info
      this.agent.doAuthServer(msg, this.socket, (err) => {
        if (err) {
          return this.socket.disconnect()
        }

        this.registered = true
      })

      this.repushQosMessage(serverId)
      return
    }

    this.agent.doSend(this.socket, 'register', {
      code: protocol.PRO_FAIL,
      msg: 'unknown auth master type'
    })

    this.socket.disconnect()
  }

  onMonitor(msg) {
    if (!this.registered) {
      // not register yet, ignore any message
      // kick connections
      this.socket.disconnect()
      return
    }

    if (this.type === Constants.TYPE_CLIENT) {
      logger.error('invalid message from monitor, but current connect type is client.')
      return
    }

    msg = protocol.parse(msg)
    const respId = msg.respId

    if (respId) {
      // a response from monitor
      const cb = this.agent.callbacks[respId]
      if (!cb) {
        logger.warn('unknown resp id:' + respId)
        return
      }

      if (this.agent.msgMap[this.id]) {
        delete this.agent.msgMap[this.id][respId]
      }
      delete this.agent.callbacks[respId]
      return cb(msg.error, msg.body)
    }

    // a request or a notify from monitor
    this.agent.consoleService.execute(msg.moduleId, 'masterHandler', msg.body, (err, res) => {
      if (protocol.isRequest(msg)) {
        const resp = protocol.composeResponse(msg, err, res)
        if (resp) {
          this.agent.doSend(this.socket, 'monitor', resp)
        }
      } else {
        // notify should not have a callback
        logger.warn('notify should not have a callback.')
      }
    })
  }

  onClient(msg) {
    if (!this.registered) {
      // not register yet, ignore any message
      // kick connections
      return this.socket.disconnect()
    }

    if (this.type !== Constants.TYPE_CLIENT) {
      logger.error('invalid message to client, but current connect type is ' + this.type)
      return
    }

    msg = protocol.parse(msg)

    const { command: msgCommand, moduleId: msgModuleId, body: msgBody } = msg

    if (msgCommand) {
      // a command from client
      this.agent.consoleService.command(msgCommand, msgModuleId, msgBody, (err, res) => {
        if (protocol.isRequest(msg)) {
          const resp = protocol.composeResponse(msg, err, res)
          if (resp) {
            this.agent.doSend(this.socket, 'client', resp)
          }
        } else {
          // notify should not have a callback
          logger.warn('notify should not have a callback.')
        }
      })
    } else {
      // a request or a notify from client
      // and client should not have any response to master for master would not request anything from client
      this.agent.consoleService.execute(msgModuleId, 'clientHandler', msgBody, (err, res) => {
        if (protocol.isRequest(msg)) {
          const resp = protocol.composeResponse(msg, err, res)
          if (resp) {
            this.agent.doSend(this.socket, 'client', resp)
          }
        } else {
          // notify should not have a callback
          logger.warn('notify should not have a callback.')
        }
      })
    }
  }

  onReconnect(msg, pid) {
    // reconnect a new connection
    if (!msg || !msg.type) return

    const serverId = msg.id

    if (!serverId) return

    // if is a normal server
    if (this.agent.idMap[serverId]) {
      // id has been registered
      this.agent.doSend(this.socket, 'reconnect_ok', {
        code: protocol.PRO_FAIL,
        msg: 'id has been registered. id:' + serverId
      })
      return
    }

    const msgServerType = msg.serverType
    const record = this.agent.addConnection(this.agent, serverId, msgServerType, msg.pid, msg.info, this.socket)

    this.id = serverId
    this.type = msgServerType
    this.registered = true
    msg.info.pid = pid
    this.info = msg.info
    this.agent.doSend(this.socket, 'reconnect_ok', {
      code: protocol.PRO_OK,
      msg: 'ok'
    })

    this.agent.emit('reconnect', msg.info)

    this.repushQosMessage(serverId)
  }

  onDisconnect() {
    if (this.socket) {
      delete this.agent.sockets[this.socket.id]
    }

    if (!this.registered) return

    const id = this.id
    const type = this.type
    const info = this.info
    const username = this.username

    logger.debug('disconnect %s %s %j', id, type, info)
    if (this.registered) {
      this.agent.removeConnection(this.agent, id, type, info)
      this.agent.emit('disconnect', id, type, info)
    }

    if (type === Constants.TYPE_CLIENT && this.registered) {
      logger.info(`client user ${username} exit`)
    }

    this.registered = false
    this.id = null
    this.type = null
  }

  repushQosMessage(serverId) {
    // repush qos message
    const qosMsgs = this.agent.msgMap[serverId]

    if (!qosMsgs) return

    logger.debug('repush qos message %j', qosMsgs)

    for (let reqId in qosMsgs) {
      const qosMsg = qosMsgs[reqId]
      const moduleId = qosMsg['moduleId']
      const tmsg = qosMsg['msg']

      this.agent.sendToMonitor(this.socket, reqId, moduleId, tmsg)
    }
  }

  onError(err) {
    // logger.error('server %s error %s', this.id, err.stack)
    // this.onDisconnect()
  }
}

module.exports = MasterSocket
