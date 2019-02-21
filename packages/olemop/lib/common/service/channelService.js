const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const ChannelRemote = require('../remote/frontend/channelRemote')

/**
 * constant
 */
const ST_INITED = 0
const ST_DESTROYED = 1

/**
 * Create and maintain channels for server local.
 *
 * ChannelService is created by channel component which is a default loaded
 * component of olemop and channel service would be accessed by `app.get('channelService')`.
 *
 * @class
 * @constructor
 */
class ChannelService {
  constructor (app, opts = {}) {
    this.app = app
    this.channels = {}
    this.prefix = opts.prefix
    this.store = opts.store
    this.broadcastFilter = opts.broadcastFilter
    this.channelRemote = new ChannelRemote(app)
  }

  start (cb) {
    _restoreChannel(this, cb)
  }

  /**
   * Create channel with name.
   *
   * @param {string} name channel's name
   */
  createChannel (name) {
    if (this.channels[name]) {
      return this.channels[name]
    }
    const c = new Channel(name, this)
    _addToStore(this, _genKey(this), _genKey(this, name))
    this.channels[name] = c
    return c
  }

  /**
   * Get channel by name.
   *
   * @param {string} name channel's name
   * @param {boolean} create if true, create channel
   * @returns {Channel}
   */
  getChannel (name, create) {
    let channel = this.channels[name]
    if (!channel && create) {
      channel = this.channels[name] = new Channel(name, this)
      _addToStore(this, _genKey(this), _genKey(this, name))
    }
    return channel
  }

  /**
   * Destroy channel by name.
   *
   * @param {string} name channel name
   */
  destroyChannel (name) {
    delete this.channels[name]
    _removeFromStore(this, _genKey(this), _genKey(this, name))
    _removeAllFromStore(this, _genKey(this, name))
  }

  /**
   * Push message by uids.
   * Group the uids by group. ignore any uid if sid not specified.
   *
   * @param {string} route message route
   * @param {Object} msg message that would be sent to client
   * @param {Array} uids the receiver info list, [{uid: userId, sid: frontendServerId}]
   * @param {Object} opts user-defined push options, optional
   * @param {Function} cb cb(err)
   */
  pushMessageByUids (route, msg, uids, opts, cb) {
    if (typeof route !== 'string') {
      cb = opts
      opts = uids
      uids = msg
      msg = route
      route = msg.route
    }

    if (!cb && typeof opts === 'function') {
      cb = opts
      opts = {}
    }

    if (!uids || uids.length === 0) {
      olemopUtils.invokeCallback(cb, new Error('uids should not be empty'))
      return
    }

    const groups = {}
    uids.forEach((record) => {
      _add(record.uid, record.sid, groups)
    })

    _sendMessageByGroup(this, route, msg, groups, opts, cb)
  }

  /**
   * Broadcast message to all the connected clients.
   *
   * @param {string}   stype      frontend server type string
   * @param {string}   route      route string
   * @param  {Object}   msg        message
   * @param  {Object}   opts       user-defined broadcast options, optional
   *                               opts.binded: push to binded sessions or all the sessions
   *                               opts.filterParam: parameters for broadcast filter.
   * @param  {Function} cb         callback
   */
  broadcast (stype, route, msg, opts = {}, cb) {
    const app = this.app
    const namespace = 'sys'
    const service = 'channelRemote'
    const method = 'broadcast'
    const servers = app.getServersByType(stype)

    // server list is empty
    if (!servers || servers.length === 0) {
      olemopUtils.invokeCallback(cb)
      return
    }

    opts = { type: 'broadcast', userOptions: opts }
    // for compatiblity
    opts.isBroadcast = true
    if (opts.userOptions) {
      opts.binded = opts.userOptions.binded
      opts.filterParam = opts.userOptions.filterParam
    }

    let successFlag = false

    Promise.all(servers.map((server) => new Promise((resolve) => {
      const serverId = server.id
      const callback = (err) => {
        resolve()
        if (err) {
          logger.error(`[broadcast] fail to push message to serverId: ${serverId}, err:${err.stack}`)
          return
        }
        successFlag = true
      }
      if (serverId === app.serverId) {
        this.channelRemote[method](route, msg, opts, callback)
      } else {
        app.rpcInvoke(serverId, { namespace, service, method, args: [route, msg, opts] }, callback)
      }
    }))).then(() => {
      if (successFlag) {
        olemopUtils.invokeCallback(cb, null)
      } else {
        olemopUtils.invokeCallback(cb, new Error('broadcast fails'))
      }
    })
  }
}

module.exports = ChannelService

/**
 * Channel maintains the receiver collection for a subject. You can
 * add users into a channel and then broadcast message to them by channel.
 *
 * @class channel
 * @constructor
 */
class Channel {
  constructor (name, service) {
    this.name = name
    // group map for uids. key: sid, value: [uid]
    this.groups = {}
    // member records. key: uid
    this.records = {}
    this.__channelService__ = service
    this.state = ST_INITED
    this.userAmount = 0
  }

  /**
   * Add user to channel.
   *
   * @param {number} uid user id
   * @param {string} sid frontend server id which user has connected to
   */
  add (uid, sid) {
    if (this.state > ST_INITED) {
      return false
    } else {
      const res = _add(uid, sid, this.groups)
      if (res) {
        this.records[uid] = { sid, uid }
        this.userAmount =this.userAmount + 1
      }
      _addToStore(this.__channelService__, _genKey(this.__channelService__, this.name), _genValue(sid, uid))
      return res
    }
  }

  /**
   * Remove user from channel.
   *
   * @param {number} uid user id
   * @param {string} sid frontend server id which user has connected to.
   * @returns [Boolean] true if success or false if fail
   */
  leave (uid, sid) {
    if (!uid || !sid) {
      return false
    }
    const res = _deleteFrom(uid, sid, this.groups[sid])
    if (res) {
      delete this.records[uid]
      this.userAmount = this.userAmount - 1
    }
    // robust
    if (this.userAmount < 0) {
      this.userAmount = 0
    }
    _removeFromStore(this.__channelService__, _genKey(this.__channelService__, this.name), _genValue(sid, uid))
    if (this.groups[sid] && this.groups[sid].length === 0) {
      delete this.groups[sid]
    }
    return res
  }

  /**
   * Get channel UserAmount in a channel.
   *
   * @returns {number } channel member amount
   */
  getUserAmount () {
    return this.userAmount
  }

  /**
   * Get channel members.
   *
   * <b>Notice:</b> Heavy operation.
   *
   * @returns {Array} channel member uid list
   */
  getMembers () {
    const res = []
    for (let sid in this.groups) {
      const group = this.groups[sid]
      group.forEach((item) => {
        res.push(item)
      })
    }
    return res
  }

  /**
   * Get Member info.
   *
   * @param {string} uid user id
   * @returns {Object} member info
   */
  getMember (uid) {
    return this.records[uid]
  }

  /**
   * Destroy channel.
   */
  destroy () {
    this.state = ST_DESTROYED
    this.__channelService__.destroyChannel(this.name)
  }

  /**
   * Push message to all the members in the channel
   *
   * @param {string} route message route
   * @param {Object} msg message that would be sent to client
   * @param {Object} opts user-defined push options, optional
   * @param {Function} cb callback function
   */
  pushMessage (route, msg, opts, cb) {
    if (this.state !== ST_INITED) {
      olemopUtils.invokeCallback(new Error('channel is not running now'))
      return
    }

    if (typeof route !== 'string') {
      cb = opts
      opts = msg
      msg = route
      route = msg.route
    }

    if (!cb && typeof opts === 'function') {
      cb = opts
      opts = {}
    }

    _sendMessageByGroup(this.__channelService__, route, msg, this.groups, opts, cb)
  }
}

/**
 * add uid and sid into group. ignore any uid that uid not specified.
 *
 * @param uid user id
 * @param sid server id
 * @param groups {Object} grouped uids, , key: sid, value: [uid]
 */
const _add = (uid, sid, groups) => {
  if (!sid) {
    logger.warn('ignore uid %j for sid not specified.', uid)
    return false
  }

  let group = groups[sid]
  if (!group) {
    group = []
    groups[sid] = group
  }

  group.push(uid)
  return true
}

/**
 * delete element from array
 */
const _deleteFrom = (uid, sid, group) => {
  if (!uid || !sid || !group) return false

  for (let i = 0; i < group.length; i++) {
    if (group[i] === uid) {
      group.splice(i, 1)
      return true
    }
  }

  return false
}

/**
 * push message by group
 *
 * @param route {string} route route message
 * @param msg {Object} message that would be sent to client
 * @param groups {Object} grouped uids, , key: sid, value: [uid]
 * @param opts {Object} push options
 * @param cb {Function} cb(err)
 */
const _sendMessageByGroup = (channelService, route, msg, groups, opts = {}, cb) => {
  const app = channelService.app
  const namespace = 'sys'
  const service = 'channelRemote'
  const method = 'pushMessage'

  logger.debug(`[${app.serverId}] channelService sendMessageByGroup route: ${route}, msg: ${msg}, groups: ${groups}, opts: ${opts}`)

  // group is empty
  if (Object.keys(groups).length === 0) {
    olemopUtils.invokeCallback(cb)
    return
  }

  opts = { type: 'push', userOptions: opts }
  // for compatiblity
  opts.isPush = true

  let successFlag = false
  let failIds = []

  Promise.all(Object.keys(groups).map((sid) => new Promise((resolve) => {
    const group = groups[sid]
    const callback = (err, fails) => {
      if (err) {
        logger.error(`[pushMessage] fail to dispatch msg to serverId: ${serverId}, err: ${err.stack}`)
      } else {
        if (fails) {
          failIds = failIds.concat(fails)
        }
        successFlag = true
      }
      resolve()
    }
    if (!group || group.length === 0) {
      process.nextTick(callback)
      return
    }
    if (sid === app.serverId) {
      channelService.channelRemote[method](route, msg, groups[sid], opts, callback)
    } else {
      app.rpcInvoke(sid, { namespace, service, method, args: [route, msg, groups[sid], opts] }, callback)
    }
  }))).then(() => {
    if (successFlag) {
      olemopUtils.invokeCallback(cb, null, failIds)
    } else {
      olemopUtils.invokeCallback(cb, new Error('all uids push message fail'))
    }
  })
}

const _restoreChannel = (self, cb) => {
  if (!self.store) {
    olemopUtils.invokeCallback(cb)
    return
  } else {
    _loadAllFromStore(self, _genKey(self), (err, list) => {
      if (err) {
        olemopUtils.invokeCallback(cb, err)
        return
      } else {
        if (!list.length || !Array.isArray(list)) {
          olemopUtils.invokeCallback(cb)
          return
        }
        const load = (key) => {
          _loadAllFromStore(self, key, (err, items) => {
            items.forEach((item) => {
              const [sid, uid] = item.split(':')
              const channel = self.channels[name]
              const res = _add(uid, sid, channel.groups)
              if (res) {
                channel.records[uid] = { sid, uid }
              }
            })
          })
        }

        list.forEach((item) => {
          const name = item.slice(_genKey(self).length + 1)
          self.channels[name] = new Channel(name, self)
          load(item)
        })
        olemopUtils.invokeCallback(cb)
      }
    })
  }
}

const _addToStore = (self, key, value) => {
  if (!self.store) return
  self.store.add(key, value, (err) => {
    if (err) {
      logger.error('add key: %s value: %s to store, with err: %j', key, value, err.stack)
    }
  })
}

const _removeFromStore = (self, key, value) => {
  if (!self.store) return
  self.store.remove(key, value, (err) => {
    if (err) {
      logger.error('remove key: %s value: %s from store, with err: %j', key, value, err.stack)
    }
  })
}

const _loadAllFromStore = (self, key, cb) => {
  if (!self.store) return
  self.store.load(key, (err, list) => {
    if (err) {
      logger.error('load key: %s from store, with err: %j', key, err.stack)
      olemopUtils.invokeCallback(cb, err)
    } else {
      olemopUtils.invokeCallback(cb, null, list)
    }
  })
}

const _removeAllFromStore = (self, key) => {
  if (!self.store) return
  self.store.removeAll(key, (err) => {
    if (err) {
      logger.error('remove key: %s all members from store, with err: %j', key, err.stack)
    }
  })
}

const _genKey = (self, name) => {
  return name ? `${self.prefix}:${self.app.serverId}:${name}` : `${self.prefix}:${self.app.serverId}`
}

const _genValue = (sid, uid) => `${sid}:${uid}`
