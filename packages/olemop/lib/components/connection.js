const olemopUtils = require('@olemop/utils')
const ConnectionService = require('../common/service/connectionService')

class Component {
  constructor(app) {
    this.name = '__connection__'
    this.app = app
    this.service = new ConnectionService(app)

    const getFun = (m) => {
      return (...args) => {
        return this.service[m].apply(this.service, args)
      }
    }

    olemopUtils.listES6ClassMethods(this.service).forEach((m) => {
      if (m !== 'start' && m !== 'stop') {
        // proxy the service methods except the lifecycle interfaces of component
        const method = this.service[m]
        if (typeof method === 'function') {
          this[m] = getFun(m)
        }
      }
    })
  }
}

/**
 * Connection component for statistics connection status of frontend servers
 */
module.exports = (app) => {
  return new Component(app)
}
