const crc32 = require('crc/crc32')
const ConsistentHash = require('../util/consistentHash')

/**
 * Calculate route info and return an appropriate server id.
 *
 * @param session {Object} session object for current rpc request
 * @param msg {Object} rpc message. {serverType, service, method, args, opts}
 * @param context {Object} context of client
 * @param cb(err, serverId)
 */
const defRoute = function (session, msg, context, cb) {
  const list = context.getServersByType(msg.serverType)
  if (!list || !list.length) {
    cb(new Error(`can not find server info for type: ${msg.serverType}`))
    return
  }
  const uid = (session && session.uid) || ''
  const index = Math.abs(crc32(uid.toString())) % list.length
  cb(null, list[index].id)
}

/**
 * Random algorithm for calculating server id.
 *
 * @param client {Object} rpc client.
 * @param serverType {String} rpc target serverType.
 * @param msg {Object} rpc message.
 * @param cb {Function} cb(err, serverId).
 */
const rdRoute = function (client, serverType, msg, cb) {
  const servers = client._station.serversMap[serverType]
  if (!servers || !servers.length) {
    cb(new Error(`rpc servers not exist with serverType: ${serverType}`))
    return
  }
  const index = Math.floor(Math.random() * servers.length)
  cb(null, servers[index])
}

/**
 * Round-Robin algorithm for calculating server id.
 *
 * @param client {Object} rpc client.
 * @param serverType {String} rpc target serverType.
 * @param msg {Object} rpc message.
 * @param cb {Function} cb(err, serverId).
 */
const rrRoute = function (client, serverType, msg, cb) {
  const servers = client._station.serversMap[serverType]
  if (!servers || !servers.length) {
    cb(new Error(`rpc servers not exist with serverType: ${serverType}`))
    return
  }
  client.rrParam = client.rrParam || {}
  let index = client.rrParam[serverType] || 0
  cb(null, servers[index % servers.length])
  if (index++ === Number.MAX_VALUE) {
    index = 0
  }
  client.rrParam[serverType] = index
}

/**
 * Weight-Round-Robin algorithm for calculating server id.
 *
 * @param client {Object} rpc client.
 * @param serverType {String} rpc target serverType.
 * @param msg {Object} rpc message.
 * @param cb {Function} cb(err, serverId).
 */
const wrrRoute = function (client, serverType, msg, cb) {
  const servers = client._station.serversMap[serverType]
  if (!servers || !servers.length) {
    cb(new Error(`rpc servers not exist with serverType: ${serverType}`))
    return
  }

  client.wrrParam = client.wrrParam || {}

  let index = client.wrrParam[serverType] ? client.wrrParam[serverType].index : -1
  let weight = client.wrrParam[serverType] ? client.wrrParam[serverType].weight : 0

  const getMaxWeight = () => {
    return servers.reduce((maxWeight, item) => {
      const server = client._station.servers[item]
      return server.weight && server.weight > maxWeight ? server.weight : maxWeight
    }, -1)
  }

  while (true) {
    index = (index + 1) % servers.length
    if (index === 0) {
      weight--
      if (weight <= 0) {
        weight = getMaxWeight()
        if (weight <= 0) {
          cb(new Error('rpc wrr route get invalid weight.'))
          return
        }
      }
    }
    const server = client._station.servers[servers[index]]
    if (server.weight >= weight) {
      client.wrrParam[serverType] = {
        index: index,
        weight: weight
      }
      cb(null, server.id)
      return
    }
  }
}

/**
 * Least-Active algorithm for calculating server id.
 *
 * @param client {Object} rpc client.
 * @param serverType {String} rpc target serverType.
 * @param msg {Object} rpc message.
 * @param cb {Function} cb(err, serverId).
 */
const laRoute = function (client, serverType, msg, cb) {
  const servers = client._station.serversMap[serverType]
  if (!servers || !servers.length) {
    return cb(new Error(`rpc servers not exist with serverType: ${serverType}`))
  }
  const actives = []

  client.laParam = client.laParam || {}

  if (client.laParam[serverType]) {
    servers.forEach((item) => {
      let count = client.laParam[serverType][item]
      if (!count) {
        client.laParam[item] = count = 0
      }
      actives.push(count)
    })
  } else {
    client.laParam[serverType] = {}
    servers.forEach((item) => {
      client.laParam[serverType][item] = 0
      actives.push(0)
    })
  }

  let rs = []
  let minInvoke = Number.MAX_VALUE

  actives.forEach((item, index) => {
    if (item < minInvoke) {
      minInvoke = item
      rs = []
      rs.push(servers[index])
    } else if (item === minInvoke) {
      rs.push(servers[index])
    }
  })

  const index = Math.floor(Math.random() * rs.length)
  const serverId = rs[index]
  client.laParam[serverType][serverId] += 1
  cb(null, serverId)
}

/**
 * Consistent-Hash algorithm for calculating server id.
 *
 * @param client {Object} rpc client.
 * @param serverType {String} rpc target serverType.
 * @param msg {Object} rpc message.
 * @param cb {Function} cb(err, serverId).
 */
const chRoute = function (client, serverType, msg, cb) {
  const servers = client._station.serversMap[serverType]
  if (!servers || !servers.length) {
    return cb(new Error(`rpc servers not exist with serverType: ${serverType}`))
  }

  client.chParam = client.chParam || {}

  let con
  if (client.chParam[serverType]) {
    con = client.chParam[serverType].consistentHash
  } else {
    client.opts.station = client._station
    con = new ConsistentHash(servers, client.opts)
  }

  const hashFieldIndex = client.opts.hashFieldIndex
  const field = msg.args[hashFieldIndex] || JSON.stringify(msg)
  cb(null, con.getNode(field))
  client.chParam[serverType] = {
    consistentHash: con
  }
}

module.exports = {
  rr: rrRoute,
  wrr: wrrRoute,
  la: laRoute,
  ch: chRoute,
  rd: rdRoute,
  df: defRoute
}
