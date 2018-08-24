const logger = require('@olemop/logger')

/**
 * Configure pomelo logger
 */
module.exports.configure = (app, filename, paramLogger) => {
  const serverId = app.getServerId()
  const base = app.getBase()
  (paramLogger || logger).configure(filename, { serverId: serverId, base: base })
}
