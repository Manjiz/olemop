const os = require('os')
const cp = require('child_process')
const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const utils = require('../util/utils')
const Constants = require('../util/constants')

const cpus = {}
// @todo
const olemop = require('../pomelo')

let env = Constants.RESERVED.ENV_DEV

const starter = module.exports

/**
 * Run all servers
 *
 * @param {Object} app current application  context
 * @returns {Void}
 */
starter.runServers = function (app) {
  let servers
  const condition = app.startId || app.type
  switch (condition) {
    case Constants.RESERVED.MASTER:
      break
    case Constants.RESERVED.ALL:
      servers = app.getServersFromConfig()
      for (let serverId in servers) {
        this.run(app, servers[serverId])
      }
      break
    default:
      const server = app.getServerFromConfig(condition)
      if (server) {
        this.run(app, server)
      } else {
        servers = app.get(Constants.RESERVED.SERVERS)[condition]
        servers.forEach((item) => {
          this.run(app, item)
        })
      }
  }
}

/**
 * Run server
 *
 * @param {Object} app current application context
 * @param {Object} server
 * @returns {Void}
 */
starter.run = (app, server, cb) => {
  env = app.get(Constants.RESERVED.ENV)
  let cmd
  if (utils.isLocal(server.host)) {
    let options = []
    if (server.args) {
      if (typeof server.args === 'string') {
        options.push(server.args.trim())
      } else {
        options = options.concat(server.args)
      }
    }
    cmd = app.get(Constants.RESERVED.MAIN)
    options.push(cmd)
    options.push(`env=${env}`)
    for (let key in server) {
      if (key === Constants.RESERVED.CPU) {
        cpus[server.id] = server[key]
      }
      options.push(`${key}=${server[key]}`)
    }
    starter.localrun(process.execPath, null, options, cb)
  } else {
    cmd = `cd "${app.getBase()}" && "${process.execPath}"`
    if (server.args !== undefined) {
      cmd += server.args
    }
    cmd += ` "${app.get(Constants.RESERVED.MAIN)}" env=${env} `
    for (let key in server) {
      if (key === Constants.RESERVED.CPU) {
        cpus[server.id] = server[key]
      }
      cmd += ` ${key}=${server[key]} `
    }
    starter.sshrun(cmd, server.host, cb)
  }
}

/**
 * Bind process with cpu
 *
 * @param {string} sid server id
 * @param {string} pid process id
 * @param {string} host server host
 * @returns {Void}
 */
starter.bindCpu = (sid, pid, host) => {
  if (os.platform() !== Constants.PLATFORM.LINUX || !cpus[sid]) return
  if (utils.isLocal(host)) {
    const options = []
    options.push('-pc')
    options.push(cpus[sid])
    options.push(pid)
    starter.localrun(Constants.COMMAND.TASKSET, null, options)
  }
  else {
    starter.sshrun(`taskset -pc "${cpus[sid]}" "${pid}"`, host, null)
  }
}

/**
 * Kill application in all servers
 *
 * @param {string} pids  array of server's pid
 * @param {string} serverIds array of serverId
 */
starter.kill = (pids, servers) => {
  servers.forEach((server) => {
    let cmd
    if (utils.isLocal(server.host)) {
      const options = []
      if (os.platform() === Constants.PLATFORM.WIN) {
        cmd = Constants.COMMAND.TASKKILL
        options.push('/pid')
        options.push('/f')
      } else {
        cmd = Constants.COMMAND.KILL
        options.push(-9)
      }
      options.push(pids[i])
      starter.localrun(cmd, null, options)
    } else {
      cmd = os.platform() === Constants.PLATFORM.WIN ? `taskkill /pid ${pids[i]} /f` : `kill -9 ${pids[i]}`
      starter.sshrun(cmd, server.host)
    }
  })
}

/**
 * Use ssh to run command.
 *
 * @param {string} cmd command that would be executed in the remote server
 * @param {string} host remote server host
 * @param {Function} cb
 */
starter.sshrun = (cmd, host, cb) => {
  let args = []
  args.push(host)
  const sshParams = olemop.app.get(Constants.RESERVED.SSH_CONFIG_PARAMS)
  if (sshParams && Array.isArray(sshParams)) {
    args = args.concat(sshParams)
  }
  args.push(cmd)

  logger.info(`Executing ${cmd} on ${host}:22`)
  spawnProcess(Constants.COMMAND.SSH, host, args, cb)
}

/**
 * Run local command.
 *
 * @param {string} cmd
 * @param {Callback} callback
 *
 */
starter.localrun = (cmd, host, options, callback) => {
  logger.info(`Executing ${cmd} ${options} locally`)
  spawnProcess(cmd, host, options, callback)
}

/**
 * Fork child process to run command.
 *
 * @param {string} command
 * @param {Object} options
 * @param {Callback} callback
 *
 */
const spawnProcess = (command, host, options, cb) => {
  let child = null

  if (env === Constants.RESERVED.ENV_DEV) {
    child = cp.spawn(command, options)
    const prefix = command === Constants.COMMAND.SSH ? `[${host}] ` : ''

    child.stderr.on('data', (chunk) => {
      const msg = chunk.toString()
      process.stderr.write(msg)
      olemopUtils.invokeCallback(cb, msg)
    })

    child.stdout.on('data', (chunk) => {
      const msg = `${prefix}${chunk.toString()}`
      process.stdout.write(msg)
    })
  } else {
    child = cp.spawn(command, options, { detached: true, stdio: 'inherit' })
    child.unref()
  }

  child.on('exit', (code) => {
    if (code !== 0) {
      logger.warn(`child process exit with error, error code: ${code}, executed command: ${command}`)
    }
    olemopUtils.invokeCallback(cb, code === 0 ? null : code)
  })
}
