/**
 * Component for remote service.
 * Load remote service and add to global context.
 */

const fs = require('fs')
const RemoteServer = require('@olemop/rpc').server
const pathUtil = require('../util/pathUtil')

/**
 * Get remote paths from application
 *
 * @param {Object} app current application context
 * @returns {Array} paths
 */
const getRemotePaths = (app) => {
  const paths = []

  // master server should not come here
  const role = app.isFrontend() ? 'frontend' : 'backend'

  const sysPath = pathUtil.getSysRemotePath(role), serverType = app.getServerType()
  if (fs.existsSync(sysPath)) {
    paths.push(pathUtil.remotePathRecord('sys', serverType, sysPath))
  }
  const userPath = pathUtil.getUserRemotePath(app.getBase(), serverType)
  if (fs.existsSync(userPath)) {
    paths.push(pathUtil.remotePathRecord('user', serverType, userPath))
  }

  return paths
}

/**
 * Generate remote server instance
 *
 * @param {Object} app current application context
 * @param {Object} opts contructor parameters for rpc Server
 * @returns {Object} remote server instance
 */
const genRemote = (app, opts) => {
  opts.paths = getRemotePaths(app)
  opts.context = app
  return opts.rpcServer ? opts.rpcServer.create(opts) : RemoteServer.create(opts)
}

class Component {
  /**
   * @param {Object} app  current application context
   * @param {Object} opts construct parameters
   */
  constructor(app, opts) {
    this.name = '__remote__'
    this.app = app
    this.opts = opts
  }

  /**
   * Remote component lifecycle function
   *
   * @param {Function} cb
   */
  start (cb) {
    this.opts.port = this.app.getCurServer().port
    this.remote = genRemote(this.app, this.opts)
    this.remote.start()
    process.nextTick(cb)
  }

  /**
   * Remote component lifecycle function
   *
   * @param {boolean}  force whether stop the component immediately
   * @param {Function}  cb
   */
  stop (force, cb) {
    this.remote.stop(force)
    process.nextTick(cb)
  }
}

/**
 * Remote component factory function
 *
 * @param {Object} app  current application context
 * @param {Object} opts construct parameters
 *                       opts.acceptorFactory {Object}: acceptorFactory.create(opts, cb)
 * @returns {Object}     remote component instances
 */
module.exports = (app, opts = {}) => {
  // cacheMsg is deprecated, just for compatibility here.
  opts.bufferMsg = opts.bufferMsg || opts.cacheMsg || false
  opts.interval = opts.interval || 30
  if (app.enabled('rpcDebugLog')) {
    opts.rpcDebugLog = true
    opts.rpcLogger = require('@olemop/logger').getLogger('rpc-debug', __filename)
  }
  return new Component(app, opts)
}
