const fs = require('fs')
const path = require('path')
const Constants = require('./constants')

module.exports = {
  /**
   * Get system remote service path
   *
   * @param {string} role server role: frontend, backend
   * @returns {string}      path string if the path exist else null
   */
  getSysRemotePath (role) {
    const p = path.join(__dirname, '/../common/remote/', role)
    return fs.existsSync(p) ? p : null
  },

  /**
   * Get user remote service path
   *
   * @param {string} appBase    application base path
   * @param {string} serverType server type
   * @returns {string}            path string if the path exist else null
   */
  getUserRemotePath (appBase, serverType) {
    const p = path.join(appBase, '/app/servers/', serverType, Constants.DIR.REMOTE)
    return fs.existsSync(p) ? p : null
  },

  /**
   * Get user remote cron path
   *
   * @param {string} appBase    application base path
   * @param {string} serverType server type
   * @returns {string}            path string if the path exist else null
   */
  getCronPath (appBase, serverType) {
    const p = path.join(appBase, '/app/servers/', serverType, Constants.DIR.CRON)
    return fs.existsSync(p) ? p : null
  },

  /**
   * List all the subdirectory names of user remote directory
   * which hold the codes for all the server types.
   *
   * @param {string} appBase application base path
   * @returns {Array}         all the subdiretory name under servers/
   */
  listUserRemoteDir (appBase) {
    const base = path.join(appBase, '/app/servers/')
    const files = fs.readdirSync(base)
    return files.filter((fn) => {
      if (fn.charAt(0) === '.') {
        return false
      }
      return fs.statSync(path.join(base, fn)).isDirectory()
    })
  },

  /**
   * Compose remote path record
   *
   * @param {string} namespace  remote path namespace, such as: 'sys', 'user'
   * @param {string} serverType
   * @param {string} path       remote service source path
   * @returns {Object}            remote path record
   */
  remotePathRecord (namespace, serverType, path) {
    return { namespace, serverType, path }
  },

  /**
   * Get handler path
   *
   * @param {string} appBase    application base path
   * @param {string} serverType server type
   * @returns {string}            path string if the path exist else null
   */
  getHandlerPath (appBase, serverType) {
    const p = path.join(appBase, '/app/servers/', serverType, Constants.DIR.HANDLER)
    return fs.existsSync(p) ? p : null
  },

  /**
   * Get admin script root path.
   *
   * @param {string} appBase application base path
   * @returns {string}         script path string
   */
  getScriptPath (appBase) {
    return path.join(appBase, Constants.DIR.SCRIPT)
  },

  /**
   * Get logs path.
   *
   * @param {string} appBase application base path
   * @returns {string}         logs path string
   */
  getLogPath (appBase) {
    return path.join(appBase, Constants.DIR.LOG)
  }
}
