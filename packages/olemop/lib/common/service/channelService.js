const olemopUtils = require('@olemop/utils')
var logger = require('@olemop/logger').getLogger('olemop', __filename)
var ChannelRemote = require('../remote/frontend/channelRemote')

/**
 * constant
 */
var ST_INITED = 0
var ST_DESTROYED = 1

/**
 * Create and maintain channels for server local.
 *
 * ChannelService is created by channel component which is a default loaded
 * component of olemop and channel service would be accessed by `app.get('channelService')`.
 *
 * @class
 * @constructor
 */
var ChannelService = function (app, opts = {}) {
  this.app = app
  this.channels = {}
  this.prefix = opts.prefix
  this.store = opts.store
  this.broadcastFilter = opts.broadcastFilter
  this.channelRemote = new ChannelRemote(app)
}

module.exports = ChannelService


ChannelService.prototype.start = function (cb) {
  restoreChannel(this, cb)
}



/**
 * Create channel with name.
 *
 * @param {string} name channel's name
 * @memberOf ChannelService
 */
ChannelService.prototype.createChannel = function (name) {
  if (this.channels[name]) {
    return this.channels[name]
  }

  var c = new Channel(name, this)
  addToStore(this, genKey(this), genKey(this, name))
  this.channels[name] = c
  return c
}

/**
 * Get channel by name.
 *
 * @param {string} name channel's name
 * @param {Boolean} create if true, create channel
 * @returns {Channel}
 * @memberOf ChannelService
 */
ChannelService.prototype.getChannel = function (name, create) {
  var channel = this.channels[name]
  if (!channel && create) {
    channel = this.channels[name] = new Channel(name, this)
    addToStore(this, genKey(this), genKey(this, name))
  }
  return channel
}

/**
 * Destroy channel by name.
 *
 * @param {string} name channel name
 * @memberOf ChannelService
 */
ChannelService.prototype.destroyChannel = function (name) {
  delete this.channels[name]
  removeFromStore(this, genKey(this), genKey(this, name))
  removeAllFromStore(this, genKey(this, name))
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
 * @memberOf ChannelService
 */
ChannelService.prototype.pushMessageByUids = function (route, msg, uids, opts, cb) {
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

  var groups = {}, record
  for (let i = 0; i<uids.length; i++) {
    record = uids[i]
    add(record.uid, record.sid, groups)
  }

  sendMessageByGroup(this, route, msg, groups, opts, cb)
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
 * @memberOf ChannelService
 */
ChannelService.prototype.broadcast = (stype, route, msg, opts = {}, cb) => {
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

/**
 * Channel maintains the receiver collection for a subject. You can
 * add users into a channel and then broadcast message to them by channel.
 *
 * @class channel
 * @constructor
 */
var Channel = function (name, service) {
  this.name = name
  // group map for uids. key: sid, value: [uid]
  this.groups = {}
  // member records. key: uid
  this.records = {}
  this.__channelService__ = service
  this.state = ST_INITED
  this.userAmount =0
}

/**
 * Add user to channel.
 *
 * @param {number} uid user id
 * @param {string} sid frontend server id which user has connected to
 */
Channel.prototype.add = function (uid, sid) {
  if (this.state > ST_INITED) {
    return false
  } else {
    var res = add(uid, sid, this.groups)
    if (res) {
      this.records[uid] = {sid: sid, uid: uid}
      this.userAmount =this.userAmount+1
    }
    addToStore(this.__channelService__, genKey(this.__channelService__, this.name), genValue(sid, uid))
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
Channel.prototype.leave = function (uid, sid) {
  if (!uid || !sid) {
    return false
  }
  var res = deleteFrom(uid, sid, this.groups[sid])
  if (res) {
    delete this.records[uid]
    this.userAmount = this.userAmount-1
  }
  // robust
  if (this.userAmount<0) this.userAmount=0
  removeFromStore(this.__channelService__, genKey(this.__channelService__, this.name), genValue(sid, uid))
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
Channel.prototype.getUserAmount = function () {
  return this.userAmount
}

/**
 * Get channel members.
 *
 * <b>Notice:</b> Heavy operation.
 *
 * @returns {Array} channel member uid list
 */
Channel.prototype.getMembers = function () {
  var res = [], groups = this.groups
  var group, i, l
  for (var sid in groups) {
    group = groups[sid]
    for (i=0, l=group.length; i<l; i++) {
      res.push(group[i])
    }
  }
  return res
}

/**
 * Get Member info.
 *
 * @param {string} uid user id
 * @returns {Object} member info
 */
Channel.prototype.getMember = function (uid) {
  return this.records[uid]
}

/**
 * Destroy channel.
 */
Channel.prototype.destroy = function () {
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
Channel.prototype.pushMessage = function (route, msg, opts, cb) {
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

  sendMessageByGroup(this.__channelService__, route, msg, this.groups, opts, cb)
}

/**
 * add uid and sid into group. ignore any uid that uid not specified.
 *
 * @param uid user id
 * @param sid server id
 * @param groups {Object} grouped uids, , key: sid, value: [uid]
 */
var add = function (uid, sid, groups) {
  if (!sid) {
    logger.warn('ignore uid %j for sid not specified.', uid)
    return false
  }

  var group = groups[sid]
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
var deleteFrom = function (uid, sid, group) {
  if (!uid || !sid || !group) {
    return false
  }

  for (var i=0, l=group.length; i<l; i++) {
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
 *
 * @api private
 */
const sendMessageByGroup = (channelService, route, msg, groups, opts = {}, cb) => {
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

var restoreChannel = function (self, cb) {
  if (!self.store) {
    olemopUtils.invokeCallback(cb)
    return
  } else {
    loadAllFromStore(self, genKey(self), function (err, list) {
      if (err) {
        olemopUtils.invokeCallback(cb, err)
        return
      } else {
        if (!list.length || !Array.isArray(list)) {
          olemopUtils.invokeCallback(cb)
          return
        }
        var load = function (key) {
          return (function () {
            loadAllFromStore(self, key, function (err, items) {
              for (var j=0; j<items.length; j++) {
                var array = items[j].split(':')
                var sid = array[0]
                var uid = array[1]
                var channel = self.channels[name]
                var res = add(uid, sid, channel.groups)
                if (res) {
                  channel.records[uid] = {sid: sid, uid: uid}
                }
              }
            })
          })()
        }

       for (var i=0; i<list.length; i++) {
        var name = list[i].slice(genKey(self).length + 1)
        self.channels[name] = new Channel(name, self)
        load(list[i])
      }
      olemopUtils.invokeCallback(cb)
    }
  })
}
}

var addToStore = function (self, key, value) {
  if (self.store) {
    self.store.add(key, value, function (err) {
      if (err) {
        logger.error('add key: %s value: %s to store, with err: %j', key, value, err.stack)
      }
    })
  }
}

var removeFromStore = function (self, key, value) {
  if (self.store) {
    self.store.remove(key, value, function (err) {
      if (err) {
        logger.error('remove key: %s value: %s from store, with err: %j', key, value, err.stack)
      }
    })
  }
}

var loadAllFromStore = function (self, key, cb) {
  if (self.store) {
    self.store.load(key, function (err, list) {
      if (err) {
        logger.error('load key: %s from store, with err: %j', key, err.stack)
        olemopUtils.invokeCallback(cb, err)
      } else {
        olemopUtils.invokeCallback(cb, null, list)
      }
    })
  }
}

var removeAllFromStore = function (self, key) {
  if (self.store) {
    self.store.removeAll(key, function (err) {
      if (err) {
        logger.error('remove key: %s all members from store, with err: %j', key, err.stack)
      }
    })
  }
}

var genKey = function (self, name) {
  if (name) {
    return self.prefix + ':' + self.app.serverId + ':' + name
  } else {
    return self.prefix + ':' + self.app.serverId
  }
}

var genValue = function (sid, uid) {
  return sid + ':' + uid
}
