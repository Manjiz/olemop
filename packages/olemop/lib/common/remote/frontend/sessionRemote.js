/**
 * Remote session service for frontend server.
 * Set session info for backend servers.
 */
const utils = require('../../../util/utils')

const Remote = function (app) {
  this.app = app
}

Remote.prototype.bind = function (sid, uid, cb) {
  this.app.get('sessionService').bind(sid, uid, cb)
}

Remote.prototype.unbind = function (sid, uid, cb) {
  this.app.get('sessionService').unbind(sid, uid, cb)
}

Remote.prototype.push = function (sid, key, value, cb) {
  this.app.get('sessionService').import(sid, key, value, cb)
}

Remote.prototype.pushAll = function (sid, settings, cb) {
  this.app.get('sessionService').importAll(sid, settings, cb)
}

/**
 * Get session informations with session id.
 *
 * @param {string}   sid session id binded with the session
 * @param  {Function} cb(err, sinfo)  callback funtion, sinfo would be null if the session not exist.
 */
Remote.prototype.getBackendSessionBySid = function (sid, cb) {
  const session = this.app.get('sessionService').get(sid)
  if (!session) {
    utils.invokeCallback(cb)
    return
  }
  utils.invokeCallback(cb, null, session.toFrontendSession().export())
}

/**
 * Get all the session informations with the specified user id.
 *
 * @param {string}   uid user id binded with the session
 * @param  {Function} cb(err, sinfo)  callback funtion, sinfo would be null if the session does not exist.
 */
Remote.prototype.getBackendSessionsByUid = function (uid, cb) {
  var sessions = this.app.get('sessionService').getByUid(uid)
  if (!sessions) {
    utils.invokeCallback(cb)
    return
  }

  var res = []
  for (var i=0; i < sessions.length; i++) {
    res.push(sessions[i].toFrontendSession().export())
  }
  utils.invokeCallback(cb, null, res)
}

/**
 * Kick a session by session id.
 *
 * @param  {number}   sid session id
 * @param {string}   reason  kick reason
 * @param  {Function} cb  callback function
 */
Remote.prototype.kickBySid = function (sid, reason, cb) {
  this.app.get('sessionService').kickBySessionId(sid, reason, cb)
}

/**
 * Kick sessions by user id.
 *
 * @param  {Number|String}   uid user id
 * @param {string}          reason     kick reason
 * @param  {Function} cb     callback function
 */
Remote.prototype.kickByUid = function (uid, reason, cb) {
  this.app.get('sessionService').kick(uid, reason, cb)
}

module.exports = function (app) {
  return new Remote(app)
}
