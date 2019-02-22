/**
 * Remote session service for frontend server.
 * Set session info for backend servers.
 */

const olemopUtils = require('@olemop/utils')

class SessionRemote {
  constructor (app) {
    this.app = app
  }

  bind (sid, uid, cb) {
    this.app.get('sessionService').bind(sid, uid, cb)
  }

  unbind (sid, uid, cb) {
    this.app.get('sessionService').unbind(sid, uid, cb)
  }

  push (sid, key, value, cb) {
    this.app.get('sessionService').import(sid, key, value, cb)
  }

  pushAll (sid, settings, cb) {
    this.app.get('sessionService').importAll(sid, settings, cb)
  }

  /**
   * Get session informations with session id.
   *
   * @param {string}   sid session id binded with the session
   * @param  {Function} cb(err, sinfo)  callback funtion, sinfo would be null if the session not exist.
   */
  getBackendSessionBySid (sid, cb) {
    const session = this.app.get('sessionService').get(sid)
    if (!session) {
      olemopUtils.invokeCallback(cb)
      return
    }
    olemopUtils.invokeCallback(cb, null, session.toFrontendSession().export())
  }

  /**
   * Get all the session informations with the specified user id.
   *
   * @param {string}   uid user id binded with the session
   * @param  {Function} cb(err, sinfo)  callback funtion, sinfo would be null if the session does not exist.
   */
  getBackendSessionsByUid (uid, cb) {
    const sessions = this.app.get('sessionService').getByUid(uid)
    if (!sessions) {
      olemopUtils.invokeCallback(cb)
      return
    }
    const res = sessions.map((item) => {
      return item.toFrontendSession().export()
    })
    olemopUtils.invokeCallback(cb, null, res)
  }

  /**
   * Kick a session by session id.
   *
   * @param  {number}   sid session id
   * @param {string}   reason  kick reason
   * @param  {Function} cb  callback function
   */
  kickBySid (sid, reason, cb) {
    this.app.get('sessionService').kickBySessionId(sid, reason, cb)
  }

  /**
   * Kick sessions by user id.
   *
   * @param  {Number|String}   uid user id
   * @param {string}          reason     kick reason
   * @param  {Function} cb     callback function
   */
  kickByUid (uid, reason, cb) {
    this.app.get('sessionService').kick(uid, reason, cb)
  }
}

module.exports = (app) => {
  return new SessionRemote(app)
}
