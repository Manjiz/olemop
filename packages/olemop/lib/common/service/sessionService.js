const EventEmitter = require('events')
const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const utils = require('../../util/utils')

const FRONTEND_SESSION_FIELDS = ['id', 'frontendId', 'uid', '__sessionService__']
const EXPORTED_SESSION_FIELDS = ['id', 'frontendId', 'uid', 'settings']

const ST_INITED = 0
const ST_CLOSED = 1

/**
 * Send message to the client that associated with the session.
 *
 * @api private
 */
const send = (service, session, msg) => {
  session.send(msg)
  return true
}

const clone = (src, dest, includes) => {
  includes.forEach((item) => {
    dest[item] = src[item]
  })
}

const dclone = (src) => {
  const res = {}
  for (let f in src) {
    res[f] = src[f]
  }
  return res
}

/**
 * Session service maintains the internal session for each client connection.
 *
 * Session service is created by session component and is only
 * <b>available</b> in frontend servers. You can access the service by
 * `app.get('sessionService')` or `app.sessionService` in frontend servers.
 *
 * @param {Object} opts constructor parameters
 * @class
 * @constructor
 */
class SessionService {
  constructor (opts = {}) {
    this.singleSession = opts.singleSession
    // sid -> session
    this.sessions = {}
    // uid -> sessions
    this.uidMap = {}
  }

  /**
   * Create and return internal session.
   *
   * @param {Integer} sid uniqe id for the internal session
   * @param {string} frontendId frontend server in which the internal session is created
   * @param {Object} socket the underlying socket would be held by the internal session
   * @returns {Session}
   *
   * @api private
   */
  create (sid, frontendId, socket) {
    const session = new Session(sid, frontendId, socket, this)
    this.sessions[session.id] = session
    return session
  }

  /**
   * Bind the session with a user id.
   *
   * @api private
   */
  bind (sid, uid, cb) {
    const session = this.sessions[sid]

    if (!session) {
      process.nextTick(() => {
        cb(new Error(`session does not exist, sid: ${sid}`))
      })
      return
    }

    if (session.uid) {
      if (session.uid === uid) {
        // already bound with the same uid
        cb()
        return
      }

      // already bound with other uid
      process.nextTick(() => {
        cb(new Error(`session has already bind with ${session.uid}`))
      })
      return
    }

    let sessionInstances = this.uidMap[uid]

    if (this.singleSession && sessionInstances) {
      process.nextTick(() => {
        cb(new Error(`singleSession is enabled, and session has already bind with uid: ${uid}`))
      })
      return
    }

    if (!sessionInstances) {
      sessionInstances = this.uidMap[uid] = []
    }

    for (let i = 0; i < sessionInstances.length; i++) {
      // session has binded with the uid
      if (sessionInstances[i].id === session.id) {
        process.nextTick(cb)
        return
      }
    }
    sessionInstances.push(session)

    session.bind(uid)

    if (cb) {
      process.nextTick(cb)
    }
  }

  /**
   * Unbind a session with the user id.
   *
   * @api private
   */
  unbind (sid, uid, cb) {
    const session = this.sessions[sid]

    if (!session) {
      process.nextTick(() => {
        cb(new Error(`session does not exist, sid: ${sid}`))
      })
      return
    }

    if (!session.uid || session.uid !== uid) {
      process.nextTick(() => {
        cb(new Error(`session has not bind with ${session.uid}`))
      })
      return
    }

    const sessionInstances = this.uidMap[uid]
    if (sessionInstances) {
      for (let i = 0; i < sessionInstances.length; i++) {
        const sess = sessionInstances[i]
        if (sess.id === sid) {
          sessionInstances.splice(i, 1)
          break
        }
      }

      if (sessionInstances.length === 0) {
        delete this.uidMap[uid]
      }
    }
    session.unbind(uid)

    if (cb) {
      process.nextTick(cb)
    }
  }

  /**
   * Get session by id.
   *
   * @param {number} id The session id
   * @returns {Session}
   *
   * @api private
   */
  get (sid) {
    return this.sessions[sid]
  }

  /**
   * Get sessions by userId.
   *
   * @param {number} uid User id associated with the session
   * @returns {Array} list of session binded with the uid
   *
   * @api private
   */
  getByUid (uid) {
    return this.uidMap[uid]
  }

  /**
   * Remove session by key.
   *
   * @param {number} sid The session id
   *
   * @api private
   */
  remove (sid) {
    const session = this.sessions[sid]

    if (!session) return

    const uid = session.uid
    delete this.sessions[session.id]

    const sessionInstances = this.uidMap[uid]

    if (!sessionInstances) return

    for (let i = 0; i < sessionInstances.length; i++) {
      if (sessionInstances[i].id === sid) {
        sessionInstances.splice(i, 1)
        if (sessionInstances.length === 0) {
          delete this.uidMap[uid]
        }
        break
      }
    }
  }

  /**
   * Import the key/value into session.
   *
   * @api private
   */
  import (sid, key, value, cb) {
    const session = this.sessions[sid]
    if (!session) {
      olemopUtils.invokeCallback(cb, new Error(`session does not exist, sid: ${sid}`))
      return
    }
    session.set(key, value)
    olemopUtils.invokeCallback(cb)
  }

  /**
   * Import new value for the existed session.
   *
   * @api private
   */
  importAll (sid, settings, cb) {
    const session = this.sessions[sid]
    if (!session) {
      olemopUtils.invokeCallback(cb, new Error(`session does not exist, sid: ${sid}`))
      return
    }

    for (let f in settings) {
      session.set(f, settings[f])
    }
    olemopUtils.invokeCallback(cb)
  }

  /**
   * Kick all the session offline under the user id.
   *
   * @param {number}   uid user id asscociated with the session
   * @param {Function} cb  callback function
   */
  kick (uid, reason, cb) {
    // compatible for old kick(uid, cb)
    if (typeof reason === 'function') {
      cb = reason
      reason = 'kick'
    }
    const sessionInstances = this.getByUid(uid)

    if (sessionInstances) {
      // notify client
      const sids = []
      sessionInstances.forEach((session) => {
        sids.push(session.id)
      })

      sids.forEach((sid) => {
        this.sessions[sid].closed(reason)
      })

      process.nextTick(() => {
        olemopUtils.invokeCallback(cb)
      })
    } else {
      process.nextTick(() => {
        olemopUtils.invokeCallback(cb)
      })
    }
  }

  /**
   * Kick a user offline by session id.
   *
   * @param {number}   sid session id
   * @param {Function} cb  callback function
   */
  kickBySessionId (sid, reason, cb) {
    if (typeof reason === 'function') {
      cb = reason
      reason = 'kick'
    }

    const session = this.get(sid)

    if (session) {
      // notify client
      session.closed(reason)
      process.nextTick(() => {
        olemopUtils.invokeCallback(cb)
      })
    } else {
      process.nextTick(() => {
        olemopUtils.invokeCallback(cb)
      })
    }
  }

  /**
   * Get client remote address by session id.
   *
   * @param {number}   sid session id
   * @returns {Object} remote address of client
   */
  getClientAddressBySessionId (sid) {
    const session = this.get(sid)
    return session ? session.__socket__.remoteAddress : null
  }

  /**
   * Send message to the client by session id.
   *
   * @param {string} sid session id
   * @param {Object} msg message to send
   *
   * @api private
   */
  sendMessage (sid, msg) {
    const session = this.get(sid)

    if (!session) {
      logger.debug(`Fail to send message for non-existing session, sid: ${sid} msg: ${msg}`)
      return false
    }

    return send(this, session, msg)
  }

  /**
   * Send message to the client by user id.
   *
   * @param {string} uid userId
   * @param {Object} msg message to send
   *
   * @api private
   */
  sendMessageByUid (uid, msg) {
    const sessionInstances = this.getByUid(uid)

    if (!sessionInstances) {
      logger.debug(`fail to send message by uid for non-existing session. uid: ${uid}`)
      return false
    }

    sessionInstances.forEach((session) => {
      send(this, session, msg)
    })

    return true
  }

  /**
   * Iterate all the session in the session service.
   *
   * @param  {Function} cb callback function to fetch session
   *
   * @api private
   */
  forEachSession (cb) {
    for (let sid in this.sessions) {
      cb(this.sessions[sid])
    }
  }

  /**
   * Iterate all the binded session in the session service.
   *
   * @param  {Function} cb callback function to fetch session
   *
   * @api private
   */
  forEachBindedSession (cb) {
    for (let uid in this.uidMap) {
      this.uidMap[uid].forEach((session) => {
        cb(session)
      })
    }
  }

  /**
   * Get sessions' quantity in specified server.
   */
  getSessionsCount () {
    return olemopUtils.size(this.sessions)
  }
}

/**
 * Session maintains the relationship between client connection and user information.
 * There is a session associated with each client connection. And it should bind to a
 * user id after the client passes the identification.
 *
 * Session is created in frontend server and should not be accessed in handler.
 * There is a proxy class called BackendSession in backend servers and FrontendSession
 * in frontend servers.
 */
class Session extends EventEmitter {
  constructor (sid, frontendId, socket, service) {
    super()
    this.id = sid
    this.frontendId = frontendId
    this.uid = null
    this.settings = {}
    // private
    this.__socket__ = socket
    this.__sessionService__ = service
    this.__state__ = ST_INITED
  }

  /*
   * Export current session as frontend session.
   */
  toFrontendSession () {
    return new FrontendSession(this)
  }

  /**
   * Bind the session with the the uid.
   *
   * @param {number} uid User id
   */
  bind (uid) {
    this.uid = uid
    this.emit('bind', uid)
  }

  /**
   * Unbind the session with the the uid.
   *
   * @param {number} uid User id
   */
  unbind (uid) {
    this.uid = null
    this.emit('unbind', uid)
  }

  /**
   * Set values (one or many) for the session.
   *
   * @param {String|Object} key session key
   * @param {Object} value session value
   */
  set (key, value) {
    if (utils.isObject(key)) {
      for (let i in key) {
        this.settings[i] = key[i]
      }
    } else {
      this.settings[key] = value
    }
  }

  /**
   * Remove value from the session.
   *
   * @param {string} key session key
   */
  remove (key) {
    delete this[key]
  }

  /**
   * Get value from the session.
   *
   * @param {string} key session key
   * @returns {Object} value associated with session key
   */
  get (key) {
    return this.settings[key]
  }

  /**
   * Send message to the session.
   *
   * @param  {Object} msg final message sent to client
   */
  send (msg) {
    this.__socket__.send(msg)
  }

  /**
   * Send message to the session in batch.
   *
   * @param  {Array} msgs list of message
   */
  sendBatch (msgs) {
    this.__socket__.sendBatch(msgs)
  }

  /**
   * Closed callback for the session which would disconnect client in next tick.
   */
  closed (reason) {
    logger.debug(`session on [${this.frontendId}] is closed with session id: ${this.id}`)

    if (this.__state__ === ST_CLOSED) return

    this.__state__ = ST_CLOSED
    this.__sessionService__.remove(this.id)
    this.emit('closed', this.toFrontendSession(), reason)
    this.__socket__.emit('closing', reason)

    // give a chance to send disconnect message to client
    process.nextTick(() => {
      this.__socket__.disconnect()
    })
  }
}

/**
 * Frontend session for frontend server.
 */
class FrontendSession extends EventEmitter {
  constructor (session) {
    super()
    clone(session, this, FRONTEND_SESSION_FIELDS)
    // deep copy for settings
    this.settings = dclone(session.settings)
    this.__session__ = session
  }

  bind (uid, cb) {
    this.__sessionService__.bind(this.id, uid, (err) => {
      if (!err) {
        this.uid = uid
      }
      olemopUtils.invokeCallback(cb, err)
    })
  }

  unbind (uid, cb) {
    this.__sessionService__.unbind(this.id, uid, (err) => {
      if (!err) {
        this.uid = null
      }
      olemopUtils.invokeCallback(cb, err)
    })
  }

  set (key, value) {
    this.settings[key] = value
  }

  get (key) {
    return this.settings[key]
  }

  push (key, cb) {
    this.__sessionService__.import(this.id, key, this.get(key), cb)
  }

  pushAll (cb) {
    this.__sessionService__.importAll(this.id, this.settings, cb)
  }

  on (event, listener) {
    // EventEmitter.prototype.on.call(this, event, listener)
    super.on(event, listener)
    this.__session__.on(event, listener)
  }

  /**
   * Export the key/values for serialization.
   *
   * @api private
   */
  export () {
    const res = {}
    clone(this, res, EXPORTED_SESSION_FIELDS)
    return res
  }
}

module.exports = SessionService
