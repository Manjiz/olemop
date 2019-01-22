const StatusService = require('../service/statusService')

module.exports = function (app, opts) {
  const service = new StatusService(app, opts)
  app.set('statusService', service, true)
  service.name = '__status__'
  return service
}
