/**
 * backend session service for backend session
 */

const olemopUtils = require('@olemop/utils')

const EXPORTED_FIELDS = ['id', 'frontendId', 'uid', 'settings']

/**
 * Service that maintains backend sessions and the communication with frontend
 * servers.
 *
 * BackendSessionService would be created in each server process and maintains
 * backend sessions for current process and communicates with the relative
 * frontend servers.
 *
 * BackendSessionService instance could be accessed by
 * `app.get('backendSessionService')` or app.backendSessionService.
 */
class BackendSessionService {
  constructor (app) {
    this.app = app
  }

  static rpcInvoke (app, sid, namespace, service, method, args, cb) {
    app.rpcInvoke(sid, { namespace, service, method, args }, cb)
  }

  create (opts) {
    if (!opts) {
      throw new Error('opts should not be empty.')
    }
    return new BackendSession(opts, this)
  }

  /**
   * Get backend session by frontend server id and session id.
   *
   * @param {string}   frontendId frontend server id that session attached
   * @param {string}   sid        session id
   * @param  {Function} cb         callback function. args: cb(err, BackendSession)
   */
  get (frontendId, sid, cb) {
    const namespace = 'sys'
    const service = 'sessionRemote'
    const method = 'getBackendSessionBySid'
    const args = [sid]
    BackendSessionService.rpcInvoke(
      this.app,
      frontendId,
      namespace,
      service,
      method,
      args,
      backendSessionCB.bind(null, this, cb)
    )
  }

  /**
   * Get backend sessions by frontend server id and user id.
   *
   * @param {string}   frontendId frontend server id that session attached
   * @param {string}   uid        user id binded with the session
   * @param  {Function} cb         callback function. args: cb(err, BackendSessions)
   */
  getByUid (frontendId, uid, cb) {
    const namespace = 'sys'
    const service = 'sessionRemote'
    const method = 'getBackendSessionsByUid'
    const args = [uid]
    BackendSessionService.rpcInvoke(
      this.app,
      frontendId,
      namespace,
      service,
      method,
      args,
      backendSessionCB.bind(null, this, cb)
    )
  }

  /**
   * Kick a session by session id.
   *
   * @param {string}   frontendId cooperating frontend server id
   * @param  {number}   sid        session id
   * @param  {Function} cb         callback function
   */
  kickBySid (frontendId, sid, reason, cb) {
    const namespace = 'sys'
    const service = 'sessionRemote'
    const method = 'kickBySid'
    const args = [sid]
    if (typeof reason === 'function') {
      cb = reason
    } else {
      args.push(reason)
    }
    BackendSessionService.rpcInvoke(this.app, frontendId, namespace, service, method, args, cb)
  }

  /**
   * Kick sessions by user id.
   *
   * @param {string}          frontendId cooperating frontend server id
   * @param  {Number|String}   uid        user id
   * @param {string}          reason     kick reason
   * @param  {Function}        cb         callback function
   */
  kickByUid (frontendId, uid, reason, cb) {
    const namespace = 'sys'
    const service = 'sessionRemote'
    const method = 'kickByUid'
    const args = [uid]
    if (typeof reason === 'function') {
      cb = reason
    } else {
      args.push(reason)
    }
    BackendSessionService.rpcInvoke(this.app, frontendId, namespace, service, method, args, cb)
  }

  /**
   * Bind the session with the specified user id. It would finally invoke the
   * the sessionService.bind in the cooperating frontend server.
   *
   * @param {string}   frontendId cooperating frontend server id
   * @param  {number}   sid        session id
   * @param {string}   uid        user id
   * @param  {Function} cb         callback function
   * @api private
   */
  bind (frontendId, sid, uid, cb) {
    const namespace = 'sys'
    const service = 'sessionRemote'
    const method = 'bind'
    const args = [sid, uid]
    BackendSessionService.rpcInvoke(this.app, frontendId, namespace, service, method, args, cb)
  }

  /**
   * Unbind the session with the specified user id. It would finally invoke the
   * the sessionService.unbind in the cooperating frontend server.
   *
   * @param {string}   frontendId cooperating frontend server id
   * @param  {number}   sid        session id
   * @param {string}   uid        user id
   * @param  {Function} cb         callback function
   * @api private
   */
  unbind (frontendId, sid, uid, cb) {
    const namespace = 'sys'
    const service = 'sessionRemote'
    const method = 'unbind'
    const args = [sid, uid]
    BackendSessionService.rpcInvoke(this.app, frontendId, namespace, service, method, args, cb)
  }

  /**
   * Push the specified customized change to the frontend internal session.
   *
   * @param {string}   frontendId cooperating frontend server id
   * @param  {number}   sid        session id
   * @param {string}   key        key in session that should be push
   * @param  {Object}   value      value in session, primitive js object
   * @param  {Function} cb         callback function
   * @api private
   */
  push (frontendId, sid, key, value, cb) {
    const namespace = 'sys'
    const service = 'sessionRemote'
    const method = 'push'
    const args = [sid, key, value]
    BackendSessionService.rpcInvoke(this.app, frontendId, namespace, service, method, args, cb)
  }

  /**
   * Push all the customized changes to the frontend internal session.
   *
   * @param {string}   frontendId cooperating frontend server id
   * @param  {number}   sid        session id
   * @param  {Object}   settings   key/values in session that should be push
   * @param  {Function} cb         callback function
   * @api private
   */
  pushAll (frontendId, sid, settings, cb) {
    const namespace = 'sys'
    const service = 'sessionRemote'
    const method = 'pushAll'
    const args = [sid, settings]
    BackendSessionService.rpcInvoke(this.app, frontendId, namespace, service, method, args, cb)
  }
}

module.exports = BackendSessionService

/**
 * BackendSession is the proxy for the frontend internal session passed to handlers and
 * it helps to keep the key/value pairs for the server locally.
 * Internal session locates in frontend server and should not be accessed directly.
 *
 * The mainly operation on backend session should be read and any changes happen in backend
 * session is local and would be discarded in next request. You have to push the
 * changes to the frontend manually if necessary. Any push would overwrite the last push
 * of the same key silently and the changes would be saw in next request.
 * And you have to make sure the transaction outside if you would push the session
 * concurrently in different processes.
 *
 * See the api below for more details.
 */
class BackendSession {
  constructor (opts, service) {
    for (let f in opts) {
      this[f] = opts[f]
    }
    this.__sessionService__ = service
  }

  /**
   * Bind current session with the user id. It would push the uid to frontend
   * server and bind  uid to the frontend internal session.
   *
   * @param  {Number|String}   uid user id
   * @param  {Function} cb  callback function
   */
  bind (uid, cb) {
    this.__sessionService__.bind(this.frontendId, this.id, uid, (err) => {
      if (!err) {
        this.uid = uid
      }
      olemopUtils.invokeCallback(cb, err)
    })
  }

  /**
   * Unbind current session with the user id. It would push the uid to frontend
   * server and unbind uid from the frontend internal session.
   *
   * @param  {Number|String}   uid user id
   * @param  {Function} cb  callback function
   */
  unbind (uid, cb) {
    this.__sessionService__.unbind(this.frontendId, this.id, uid, (err) => {
      if (!err) {
        this.uid = null
      }
      olemopUtils.invokeCallback(cb, err)
    })
  }

  /**
   * Set the key/value into backend session.
   *
   * @param {string} key   key
   * @param {Object} value value
   */
  set (key, value) {
    this.settings[key] = value
  }

  /**
   * Get the value from backend session by key.
   *
   * @param {string} key key
   * @returns {Object} value
   */
  get (key) {
    return this.settings[key]
  }

  /**
   * Push the key/value in backend session to the front internal session.
   *
   * @param {string}   key key
   * @param  {Function} cb  callback function
   */
  push (key, cb) {
    this.__sessionService__.push(this.frontendId, this.id, key, this.get(key), cb)
  }

  /**
   * Push all the key/values in backend session to the frontend internal session.
   *
   * @param  {Function} cb callback function
   */
  pushAll (cb) {
    this.__sessionService__.pushAll(this.frontendId, this.id, this.settings, cb)
  }

  /**
   * Export the key/values for serialization.
   *
   * @api private
   */
  export () {
    return EXPORTED_FIELDS.reduce((prev, field) => {
      prev[field] = this[field]
      return prev
    }, {})
  }
}

const backendSessionCB = (service, cb, err, sinfo) => {
  if (err) {
    olemopUtils.invokeCallback(cb, err)
    return
  }

  if (!sinfo) {
    olemopUtils.invokeCallback(cb)
    return
  }
  let sessions = []
  if (Array.isArray(sinfo)) {
    // #getByUid
    sinfo.forEach((item) => {
      sessions.push(service.create(item))
    })
  } else {
    // #get
    sessions = service.create(sinfo)
  }
  olemopUtils.invokeCallback(cb, null, sessions)
}
