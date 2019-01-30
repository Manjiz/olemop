const rsa = require('node-bignumber')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const taskManager = require('../common/manager/taskManager')
const DefaultConnector = require('../connectors/sioconnector')
const pomelo = require('../pomelo')
const events = require('../util/events')
const utils = require('../util/utils')

const getConnector = (app, opts) => {
  const connector = opts.connector
  if (!connector) {
    return getDefaultConnector(app, opts)
  }

  if (typeof connector !== 'function') {
    return connector
  }

  const curServer = app.getCurServer()
  return connector(curServer.clientPort, curServer.host, opts)
}

const getDefaultConnector = (app, opts) => {
  const curServer = app.getCurServer()
  return new DefaultConnector(curServer.clientPort, curServer.host, opts)
}

const hostFilter = function (cb, socket) {
  if (!this.useHostFilter) {
    return cb(this, socket)
  }

  const ip = socket.remoteAddress.ip
  const check = (list) => {
    for (let address in list) {
      const exp = new RegExp(list[address])
      if (exp.test(ip)) {
        socket.disconnect()
        return true
      }
    }
    return false
  }

  // dynamical check
  if (this.blacklist.length !== 0 && check(this.blacklist)) return

  // static check
  if (this.blacklistFun && typeof this.blacklistFun === 'function') {
    this.blacklistFun((err, list) => {
      if (err) {
        logger.error(`connector blacklist error: ${err.stack}`)
        utils.invokeCallback(cb, this, socket)
        return
      }
      if (!Array.isArray(list)) {
        logger.error('connector blacklist is not array: %j', list)
        utils.invokeCallback(cb, this, socket)
        return
      }
      if (check(list)) return
      utils.invokeCallback(cb, this, socket)
    })
  } else {
    utils.invokeCallback(cb, this, socket)
  }
}

const bindEvents = (self, socket) => {
  const curServer = self.app.getCurServer()
  const maxConnections = curServer['max-connections']
  if (self.connection && maxConnections) {
    self.connection.increaseConnectionCount()
    const statisticInfo = self.connection.getStatisticsInfo()
    if (statisticInfo.totalConnCount > maxConnections) {
      logger.warn(`the server ${curServer.id} has reached the max connections ${maxConnections}`)
      socket.disconnect()
      return
    }
  }

  // create session for connection
  const session = getSession(self, socket)
  let closed = false

  socket.on('disconnect', () => {
    if (closed) return
    closed = true
    if (self.connection) {
      self.connection.decreaseConnectionCount(session.uid)
    }
  })

  socket.on('error', () => {
    if (closed) return
    closed = true
    if (self.connection) {
      self.connection.decreaseConnectionCount(session.uid)
    }
  })

  // new message
  socket.on('message', (msg) => {
    let dmsg = msg
    if (self.useAsyncCoder) {
      return handleMessageAsync(self, msg, session, socket)
    }

    if (self.decode) {
      dmsg = self.decode(msg, session)
    } else if (self.connector.decode) {
      dmsg = self.connector.decode(msg, socket)
    }

    // discard invalid message
    if (!dmsg) return

    // use rsa crypto
    if (self.useCrypto) {
      const verified = verifyMessage(self, session, dmsg)
      if (!verified) {
        logger.error('fail to verify the data received from client.')
        return
      }
    }

    handleMessage(self, session, dmsg)
  })
  // on message end
}

const handleMessageAsync = (self, msg, session, socket) => {
  if (self.decode) {
    self.decode(msg, session, (err, dmsg) => {
      if (err) {
        logger.error(`fail to decode message from client ${err.stack}`)
        return
      }

      doHandleMessage(self, dmsg, session)
    })
  } else if (self.connector.decode) {
    self.connector.decode(msg, socket, (err, dmsg) => {
      if (err) {
        logger.error(`fail to decode message from client ${err.stack}`)
        return
      }

      doHandleMessage(self, dmsg, session)
    })
  }
}

const doHandleMessage = (self, dmsg, session) => {
  // discard invalid message
  if (!dmsg) return

  // use rsa crypto
  if (self.useCrypto) {
    if (!verifyMessage(self, session, dmsg)) {
      logger.error('fail to verify the data received from client.')
      return
    }
  }

  handleMessage(self, session, dmsg)
}

/**
 * get session for current connection
 */
const getSession = (self, socket) => {
  const app = self.app
  const sid = socket.id
  let session = self.session.get(sid)
  if (session) {
    return session
  }

  session = self.session.create(sid, app.getServerId(), socket)
  logger.debug(`[${app.getServerId()}] getSession session is created with session id: ${sid}`)

  // bind events for session
  socket.on('disconnect', session.closed.bind(session))
  socket.on('error', session.closed.bind(session))
  session.on('closed', onSessionClose.bind(null, app))
  session.on('bind', (uid) => {
    logger.debug(`session on [${app.serverId}] bind with uid: ${uid}`)
    // update connection statistics if necessary
    if (self.connection) {
      self.connection.addLoginedUser(uid, {
        loginTime: Date.now(),
        uid,
        address: `${socket.remoteAddress.ip}:${socket.remoteAddress.port}`
      })
    }
    app.event.emit(events.BIND_SESSION, session)
  })

  session.on('unbind', (uid) => {
    if (self.connection) {
      self.connection.removeLoginedUser(uid)
    }
    app.event.emit(events.UNBIND_SESSION, session)
  })

  return session
}

const onSessionClose = (app, session, reason) => {
  taskManager.closeQueue(session.id, true)
  app.event.emit(events.CLOSE_SESSION, session)
}

const handleMessage = (self, session, msg) => {
  logger.debug(`[${self.app.serverId}] handleMessage session id: ${session.id}, msg:${msg}`)
  const type = checkServerType(msg.route)
  if (!type) {
    logger.error(`invalid route string. route : ${msg.route}`)
    return
  }
  self.server.globalHandle(msg, session.toFrontendSession(), (err, resp, opts) => {
    if (resp && !msg.id) {
      logger.warn(`try to response to a notify: ${msg.route}`)
      return
    }
    if (!msg.id && !resp) return
    if (!resp) resp = {}
    if (err && !resp.code) {
      resp.code = 500
    }
    opts = { type: 'response', userOptions: opts || {} }
    // for compatiablity
    opts.isResponse = true

    self.send(msg.id, msg.route, resp, [session.id], opts, () => {})
  })
}

/**
 * Get server type form request message.
 */
const checkServerType = (route) => {
  if (!route) {
    return null
  }
  const idx = route.indexOf('.')
  if (idx < 0) {
    return null
  }
  return route.substring(0, idx)
}

const verifyMessage = (self, session, msg) => {
  const sig = msg.body.__crypto__
  if (!sig) {
    logger.error(`receive data from client has no signature [${self.app.serverId}]`)
    return false
  }

  let pubKey

  if (!session) {
    logger.error('could not find session.')
    return false
  }

  if (!session.get('pubKey')) {
    pubKey = self.getPubKey(session.id)
    if (pubKey) {
      delete self.keys[session.id]
      session.set('pubKey', pubKey)
    } else {
      logger.error(`could not get public key, session id is ${session.id}`)
      return false
    }
  } else {
    pubKey = session.get('pubKey')
  }

  if (!pubKey.n || !pubKey.e) {
    logger.error(`could not verify message without public key [${self.app.serverId}]`)
    return false
  }

  delete msg.body.__crypto__

  let message = JSON.stringify(msg.body)
  if (utils.hasChineseChar(message)) {
    message = utils.unicodeToUtf8(message)
  }

  return pubKey.verifyString(message, sig)
}

/**
 * Connector component. Receive client requests and attach session with socket.
 *
 * @param {Object} app  current application context
 * @param {Object} opts attach parameters
 *                      opts.connector {Object} provides low level network and protocol details implementation between server and clients.
 */
class Component {
  constructor(app, opts) {
    this.name = '__connector__'
    opts = opts || {}
    this.app = app
    this.connector = getConnector(app, opts)
    this.encode = opts.encode
    this.decode = opts.decode
    this.useCrypto = opts.useCrypto
    this.useHostFilter = opts.useHostFilter
    this.useAsyncCoder = opts.useAsyncCoder
    this.blacklistFun = opts.blacklistFun
    this.keys = {}
    this.blacklist = []

    if (opts.useDict) {
      app.load(pomelo.dictionary, app.get('dictionaryConfig'))
    }

    if (opts.useProtobuf) {
      app.load(pomelo.protobuf, app.get('protobufConfig'))
    }

    // component dependencies
    this.server = null
    this.session = null
    this.connection = null
  }

  start (cb) {
    this.server = this.app.components.__server__
    this.session = this.app.components.__session__
    this.connection = this.app.components.__connection__

    // check component dependencies
    if (!this.server) {
      process.nextTick(() => {
        utils.invokeCallback(cb, new Error('fail to start connector component for no server component loaded'))
      })
      return
    }

    if (!this.session) {
      process.nextTick(() => {
        utils.invokeCallback(cb, new Error('fail to start connector component for no session component loaded'))
      })
      return
    }

    process.nextTick(cb)
  }

  afterStart (cb) {
    this.connector.start(cb)
    this.connector.on('connection', hostFilter.bind(this, bindEvents))
  }

  stop (force, cb) {
    if (this.connector) {
      this.connector.stop(force, cb)
      this.connector = null
      return
    } else {
      process.nextTick(cb)
    }
  }

  send (reqId, route, msg, recvs, opts, cb) {
    logger.debug('[%s] send message reqId: %s, route: %s, msg: %j, receivers: %j, opts: %j', this.app.serverId, reqId, route, msg, recvs, opts)
    if (this.useAsyncCoder) {
      return this.sendAsync(reqId, route, msg, recvs, opts, cb)
    }

    let emsg = msg
    if (this.encode) {
      // use costumized encode
      emsg = this.encode.call(this, reqId, route, msg)
    } else if (this.connector.encode) {
      // use connector default encode
      emsg = this.connector.encode(reqId, route, msg)
    }

    this.doSend(reqId, route, emsg, recvs, opts, cb)
  }

  sendAsync (reqId, route, msg, recvs, opts, cb) {
    let emsg = msg

    if (this.encode) {
      // use costumized encode
      this.encode(reqId, route, msg, (err, encodeMsg) => {
        if (err) {
          return cb(err)
        }

        emsg = encodeMsg
        this.doSend(reqId, route, emsg, recvs, opts, cb)
      })
    } else if (this.connector.encode) {
      // use connector default encode
      this.connector.encode(reqId, route, msg, (err, encodeMsg) => {
        if (err) {
          return cb(err)
        }

        emsg = encodeMsg
        this.doSend(reqId, route, emsg, recvs, opts, cb)
      })
    }
  }

  doSend (reqId, route, emsg, recvs, opts, cb) {
    if (!emsg) {
      process.nextTick(() => {
        return cb && cb(new Error('fail to send message for encode result is empty.'))
      })
    }

    this.app.components.__pushScheduler__.schedule(reqId, route, emsg,
      recvs, opts, cb)
  }

  setPubKey (id, key) {
    const pubKey = new rsa.Key()
    pubKey.n = new rsa.BigInteger(key.rsa_n, 16)
    pubKey.e = key.rsa_e
    this.keys[id] = pubKey
  }

  getPubKey (id) {
    return this.keys[id]
  }
}

module.exports = (app, opts) => {
  return new Component(app, opts)
}
