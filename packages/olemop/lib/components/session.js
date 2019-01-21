const olemopUtils = require('@olemop/utils')
const SessionService = require('../common/service/sessionService')

/**
 * Session component. Manage sessions.
 *
 * @param {Object} app  current application context
 * @param {Object} opts attach parameters
 */
class Component {
  constructor (app, opts) {
    const self = this
    this.name = '__session__'
    opts = opts || {}
    this.app = app
    this.service = new SessionService(opts)

    const getFun = (m) => {
      return (() => {
        return function () {
          return self.service[m].apply(self.service, arguments)
        }
      })()
    }
    // proxy the service methods except the lifecycle interfaces of component
    // var method, self = this
    // for (var m in this.service) {
    //   if (m !== 'start' && m !== 'stop') {
    //     method = this.service[m]
    //     if (typeof method === 'function') {
    //       this[m] = getFun(m)
    //     }
    //   }
    // }
    olemopUtils.listES6ClassMethods(this.service).forEach((field) => {
      if (field !== 'start' && field !== 'stop') {
        const method = this.service[field]
        if (typeof method === 'function') {
          this[field] = getFun(field)
        }
      }
    })
  }
}

module.exports = (app, opts) => {
  const cmp = new Component(app, opts)
  app.set('sessionService', cmp, true)
  return cmp
}
