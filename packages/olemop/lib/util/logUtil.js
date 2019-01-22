const logger = require('@olemop/logger')

/**
 * Configure pomelo logger
 */
module.exports.configure = function (app, filename, paramLogger) {
  const serverId = app.getServerId()
  const base = app.getBase()
  const _logger = paramLogger || logger
  _logger.configure(filename, { serverId: serverId, base: base })
}
