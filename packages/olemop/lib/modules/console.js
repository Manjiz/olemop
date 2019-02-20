/**
 * Olemop -- consoleModule serverStop stop/kill
 */

const { exec } = require('child_process')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const countDownLatch = require('../util/countDownLatch')
const utils = require('../util/utils')
const Constants = require('../util/constants')
const starter = require('../master/starter')

module.exports = function (opts) {
  return new Module(opts)
}

const moduleId = '__console__'

module.exports.moduleId = moduleId

const Module = function (opts = {}) {
  this.app = opts.app
  this.starter = opts.starter
}

Module.prototype.monitorHandler = function (agent, msg, cb) {
  const serverId = agent.id
  switch (msg.signal) {
    case 'stop':
      if (agent.type === Constants.RESERVED.MASTER) return
      this.app.stop(true)
      break
    case 'list':
      const serverType = agent.type
      const pid = process.pid
      const heapUsed = (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2)
      const rss = (process.memoryUsage().rss / (1024 * 1024)).toFixed(2)
      const heapTotal = (process.memoryUsage().heapTotal / (1024 * 1024)).toFixed(2)
      const uptime = (process.uptime() / 60).toFixed(2)
      utils.invokeCallback(cb, {
        serverId,
        body: { serverId, serverType, pid, rss, heapTotal, heapUsed, uptime }
      })
      break
    case 'kill':
      utils.invokeCallback(cb, serverId)
      if (agent.type !== 'master') {
        setTimeout(() => {
          process.exit(-1)
        }, Constants.TIME.TIME_WAIT_MONITOR_KILL)
      }
      break
    case 'addCron':
      this.app.addCrons([msg.cron])
      break
    case 'removeCron':
      this.app.removeCrons([msg.cron])
      break
    case 'blacklist':
      if (this.app.isFrontend()) {
        const connector = this.app.components.__connector__
        connector.blacklist = connector.blacklist.concat(msg.blacklist)
      }
      break
    case 'restart':
      if (agent.type === Constants.RESERVED.MASTER) return
      const server = this.app.get(Constants.RESERVED.CURRENT_SERVER)
      utils.invokeCallback(cb, server)
      process.nextTick(() => {
        this.app.stop(true)
      })
      break
    default:
      logger.error('receive error signal: %j', msg)
      break
  }
}

Module.prototype.clientHandler = function (agent, msg, cb) {
  switch (msg.signal) {
    case 'kill':
      kill(this.app, agent, msg, cb)
      break
    case 'stop':
      stop(this.app, agent, msg, cb)
      break
    case 'list':
      list(agent, msg, cb)
      break
    case 'add':
      add(this.app, msg, cb)
      break
    case 'addCron':
      addCron(this.app, agent, msg, cb)
      break
    case 'removeCron':
      removeCron(this.app, agent, msg, cb)
      break
    case 'blacklist':
      blacklist(agent, msg, cb)
      break
    case 'restart':
      restart(this.app, agent, msg, cb)
      break
    default:
      utils.invokeCallback(cb, new Error('The command cannot be recognized, please check.'), null)
      break
  }
}

const kill = (app, agent, msg, cb) => {
  const serverIds = []
  const count = utils.size(agent.idMap)
  const latch = countDownLatch.createCountDownLatch(count, { timeout: Constants.TIME.TIME_WAIT_MASTER_KILL }, (isTimeout) => {
    if (!isTimeout) {
      utils.invokeCallback(cb, null, { code: 'ok' })
    } else {
      utils.invokeCallback(cb, null, { code: 'remained', serverIds })
    }
    setTimeout(() => {
      process.exit(-1)
    }, Constants.TIME.TIME_WAIT_MONITOR_KILL)
  })

  const agentRequestCallback = (msg) => {
    for (let i = 0; i < serverIds.length; i++) {
      if (serverIds[i] === msg) {
        serverIds.splice(i,1)
        latch.done()
        break
      }
    }
  }

  for (let sid in agent.idMap) {
    const record = agent.idMap[sid]
    serverIds.push(record.id)
    agent.request(record.id, moduleId, { signal: msg.signal }, agentRequestCallback)
  }
}

const stop = (app, agent, msg, cb) => {
  let serverIds = msg.ids
  const servers = app.getServers()
  if (serverIds.length) {
    app.set(Constants.RESERVED.STOP_SERVERS, serverIds)
    serverIds.forEach((serverId) => {
      if (!servers[serverId]) {
        utils.invokeCallback(cb, new Error('Cannot find the server to stop.'), null)
      } else {
        agent.notifyById(serverId, moduleId, { signal: msg.signal })
      }
    })
    utils.invokeCallback(cb, null, { status: 'part' })
  } else {
    serverIds = Object.keys(servers).map((serverId) => serverId)
    app.set(Constants.RESERVED.STOP_SERVERS, serverIds)
    agent.notifyAll(moduleId, { signal: msg.signal })
    setTimeout(() => {
      app.stop(true)
      utils.invokeCallback(cb, null, { status: 'all' })
    }, Constants.TIME.TIME_WAIT_STOP)
  }
}

const restart = (app, agent, msg, cb) => {
  let successFlag
  const successIds = []
  const serverIds = msg.ids
  const type = msg.type
  let servers
  if (!serverIds.length && type) {
    servers = app.getServersByType(type)
    if (!servers) {
      utils.invokeCallback(cb, new Error(`restart servers with unknown server type: ${type}`))
      return
    }
    servers.forEach((server) => {
      serverIds.push(server.id)
    })
  } else if (!serverIds.length) {
    servers = app.getServers()
    for (let key in servers) {
      serverIds.push(key)
    }
  }
  const count = serverIds.length
  const latch = countDownLatch.createCountDownLatch(count, { timeout: Constants.TIME.TIME_WAIT_COUNTDOWN }, () => {
    if (!successFlag) {
      utils.invokeCallback(cb, new Error('all servers start failed.'))
      return
    }
    utils.invokeCallback(cb, null, utils.arrayDiff(serverIds, successIds))
  })

  const request = (id) => {
    return (() => {
      agent.request(id, moduleId, { signal: msg.signal }, (msg) => {
        if (!utils.size(msg)) {
          latch.done()
          return
        }
        setTimeout(() => {
          runServer(app, msg, (err, status) => {
            if (err) {
              logger.error('restart ' + id + ' failed.')
            } else {
              successIds.push(id)
              successFlag = true
            }
            latch.done()
          })
        }, Constants.TIME.TIME_WAIT_RESTART)
      })
    })()
  }

  serverIds.forEach((item) => {
    request(item)
  })
}

const list = (agent, msg, cb) => {
  const serverInfo = {}
  const count = utils.size(agent.idMap)
  const latch = countDownLatch.createCountDownLatch(count, { timeout: Constants.TIME.TIME_WAIT_COUNTDOWN }, () => {
    utils.invokeCallback(cb, null, { msg: serverInfo })
  })

  const callback = (msg) => {
    serverInfo[msg.serverId] = msg.body
    latch.done()
  }
  for (let sid in agent.idMap) {
    const record = agent.idMap[sid]
    agent.request(record.id, moduleId, { signal: msg.signal }, callback)
  }
}

const add = (app, msg, cb) => {
  if (checkCluster(msg)) {
    startCluster(app, msg, cb)
  } else {
    startServer(app, msg, cb)
  }
  reset(ServerInfo)
}

const addCron = (app, agent, msg, cb) => {
  const cron = parseArgs(msg, CronInfo, cb)
  sendCronInfo(cron, agent, msg, CronInfo, cb)
}

const removeCron = (app, agent, msg, cb) => {
  const cron = parseArgs(msg, RemoveCron, cb)
  sendCronInfo(cron, agent, msg, RemoveCron, cb)
}

const blacklist = (agent, msg, cb) => {
  const ips = msg.args
  for (let i = 0; i < ips.length; i++) {
    if (!(new RegExp(/(\d+)\.(\d+)\.(\d+)\.(\d+)/g).test(ips[i]))) {
      utils.invokeCallback(cb, new Error(`blacklist ip: ${ips[i]} is error format.`), null)
      return
    }
  }
  agent.notifyAll(moduleId, { signal: msg.signal, blacklist: msg.args })
  process.nextTick(() => {
    cb(null, { status: 'ok' })
  })
}

const checkPort = (server, cb) => {
  if (!server.port && !server.clientPort) {
    utils.invokeCallback(cb, 'leisure')
    return
  }

  let port = server.port || server.clientPort
  const host = server.host
  let cmd = 'netstat -tln | grep '
  if (!utils.isLocal(host)) {
    cmd = `ssh ${host} ${cmd}`
  }

  exec(cmd + port, (err, stdout, stderr) => {
    if (stdout || stderr) {
      utils.invokeCallback(cb, 'busy')
    } else {
      port = server.clientPort
      exec(cmd + port, (err, stdout, stderr) => {
        if (stdout || stderr) {
          utils.invokeCallback(cb, 'busy')
        } else {
          utils.invokeCallback(cb, 'leisure')
        }
      })
    }
  })
}

const parseArgs = (msg, info, cb) => {
  const rs = {}
  const args = msg.args
  for (let i = 0; i < args.length; i++) {
    if (args[i].indexOf('=') < 0) {
      cb(new Error('Error server parameters format.'), null)
      return
    }
    const pairs = args[i].split('=')
    const key = pairs[0]
    if (info[key]) {
      info[key] = 1
    }
    rs[pairs[0]] = pairs[1]
  }
  return rs
}

const sendCronInfo = (cron, agent, msg, info, cb) => {
  if (isReady(info) && (cron.serverId || cron.serverType)) {
    if (cron.serverId) {
      agent.notifyById(cron.serverId, moduleId, { signal: msg.signal, cron })
    } else {
      agent.notifyByType(cron.serverType, moduleId, { signal: msg.signal, cron })
    }
    process.nextTick(() => {
      cb(null, { status: 'ok' })
    })
  } else {
    cb(new Error('Miss necessary server parameters.'), null)
  }
  reset(info)
}

const startServer = (app, msg, cb) => {
  const server = parseArgs(msg, ServerInfo, cb)
  if (isReady(ServerInfo)) {
    runServer(app, server, cb)
  } else {
    cb(new Error('Miss necessary server parameters.'), null)
  }
}

const runServer = (app, server, cb) => {
  checkPort(server, (status) => {
    if (status === 'busy') {
      utils.invokeCallback(cb, new Error('Port occupied already, check your server to add.'))
    } else {
      starter.run(app, server, (err) => {
        if (err) {
          utils.invokeCallback(cb, new Error(err), null)
          return
        }
      })
      process.nextTick(() => {
        utils.invokeCallback(cb, null, { status: 'ok' })
      })
    }
  })
}

const startCluster = (app, msg, cb) => {
  const serverMap = {}
  const fails = []
  let successFlag
  const serverInfo = parseArgs(msg, ClusterInfo, cb)
  utils.loadCluster(app, serverInfo, serverMap)
  const count = utils.size(serverMap)
  const latch = countDownLatch.createCountDownLatch(count, () => {
    if (!successFlag) {
      utils.invokeCallback(cb, new Error('all servers start failed.'))
      return
    }
    utils.invokeCallback(cb, null, fails)
  })

  const start = (server) => {
    return (() => {
      checkPort(server, (status) => {
        if (status === 'busy') {
          fails.push(server)
          latch.done()
        } else {
          starter.run(app, server, (err) => {
            if (err) {
              fails.push(server)
              latch.done()
            }
          })
          process.nextTick(() => {
            successFlag = true
            latch.done()
          })
        }
      })
    })()
  }
  for (let key in serverMap) {
    start(serverMap[key])
  }
}

const checkCluster = (msg) => {
  let flag = false
  msg.args.forEach((arg) => {
    if (utils.startsWith(arg, Constants.RESERVED.CLUSTER_COUNT)) {
      flag = true
    }
  })
  return flag
}

const isReady = (info) => {
  for (let key in info) {
    if (info[key]) {
      return false
    }
  }
  return true
}

const reset = (info) => {
  for (let key in info) {
    info[key] = 0
  }
}

const ServerInfo = {
  host: 0,
  port: 0,
  id: 0,
  serverType: 0
}

const CronInfo = {
  id: 0,
  action: 0,
  time: 0
}

const RemoveCron = {
  id: 0
}

const ClusterInfo = {
  host: 0,
  port: 0,
  clusterCount: 0
}
