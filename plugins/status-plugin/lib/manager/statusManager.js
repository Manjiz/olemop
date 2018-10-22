const olemoptUtils = require('@olemop/utils')
const redis = require('redis')

const DEFAULT_PREFIX = 'OLEMOP:STATUS'

const execMultiCommands = (redis, cmds, cb) => {
  if (!cmds.length) {
    olemoptUtils.invokeCallback(cb)
    return
  }
  redis.multi(cmds).exec((err, replies) => {
    olemoptUtils.invokeCallback(cb, err, replies)
  })
}

const genKey = (self, uid) => {
  return `${self.prefix}:${uid}`
}

const genCleanKey = (self) => {
  return `${self.prefix}*`
}

class StatusManager {
  constructor (app, opts) {
    this.app = app
    this.opts = opts || {}
    this.prefix = opts.prefix || DEFAULT_PREFIX
    this.host = opts.host
    this.port = opts.port
    this.redis = null
  }

  start (cb) {
    this.redis = redis.createClient(this.port, this.host, this.opts)
    if (this.opts.auth_pass) {
      this.redis.auth(this.opts.password)
    }
    this.redis.on('error', (err) => {
      console.error(`[status-plugin][redis]${err.stack}`)
    })
    this.redis.once('ready', cb)
  }

  stop (force, cb) {
    if (this.redis) {
      this.redis.end()
      this.redis = null
    }
    olemoptUtils.invokeCallback(cb)
  }

  clean (cb) {
    const self = this
    this.redis.keys(genCleanKey(this), (err, list) => {
      if (err) {
        olemoptUtils.invokeCallback(cb, err)
        return
      }
      const cmds = list.map((item) => ['del', item])
      execMultiCommands(self.redis, cmds, cb)
    })
  }

  add (uid, sid ,cb) {
    this.redis.sadd(genKey(this, uid), sid, (err) => {
      olemoptUtils.invokeCallback(cb, err)
    })
  }

  leave (uid, sid, cb) {
    this.redis.srem(genKey(this, uid), sid, (err) => {
      olemoptUtils.invokeCallback(cb, err)
    })
  }

  getSidsByUid (uid, cb) {
    this.redis.smembers(genKey(this, uid), (err, list) => {
      olemoptUtils.invokeCallback(cb, err, list)
    })
  }

  getSidsByUids (uids, cb) {
    const cmds = uids.map((item) => ['exists', genKey(this, item)])
    execMultiCommands(this.redis, cmds, (err, list) => {
      olemoptUtils.invokeCallback(cb, err, list)
    })
  }
}

module.exports = StatusManager
