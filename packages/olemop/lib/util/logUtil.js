const logger = require('@olemop/logger')

/**
 * Configure olemop logger
 */
module.exports.configure = (app, filename, paramLogger = logger) => {
  const serverId = app.getServerId()
  const base = app.getBase()
  paramLogger.configure(filename, { serverId, base })
}
