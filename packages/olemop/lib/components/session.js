const olemopUtils = require('@olemop/utils')
const SessionService = require('../common/service/sessionService')

/**
 * Session component. Manage sessions.
 *
 * @param {Object} app  current application context
 * @param {Object} opts attach parameters
 */
class SessionComponent {
  constructor (app, opts = {}) {
    this.name = '__session__'
    this.app = app
    this.service = new SessionService(opts)

    const getFun = (m) => {
      return (...args) => {
        return this.service[m].apply(this.service, args)
      }
    }
    // proxy the service methods except the lifecycle interfaces of component
    // for (let m in this.service) {
    //   if (m !== 'start' && m !== 'stop') {
    //     const method = this.service[m]
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
  const cmp = new SessionComponent(app, opts)
  app.set('sessionService', cmp, true)
  return cmp
}
