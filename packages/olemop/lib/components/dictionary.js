const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const Loader = require('@olemop/loader')
const olemopUtils = require('@olemop/utils')
const pathUtil = require('../util/pathUtil')

class Component {
  constructor(app, opts) {
    this.name = '__dictionary__'
    this.app = app
    this.dict = {}
    this.abbrs = {}
    this.userDicPath = null
    this.version = ''

    // Set user dictionary
    const p = opts && opts.dict ? opts.dict : path.join(app.getBase(), '/config/dictionary.json')

    if (fs.existsSync(p)) {
      this.userDicPath = p
    }
  }

  start (cb) {
    const servers = this.app.get('servers')
    const routes = []

    // Load all the handler files
    for (let serverType in servers) {
      const p = pathUtil.getHandlerPath(this.app.getBase(), serverType)

      if (!p) continue

      const handlers = Loader.load(p, this.app)

      for (let name in handlers) {
        const handler = handlers[name]
        for (let key in handler) {
          if (typeof(handler[key]) === 'function') {
            routes.push(`${serverType}.${name}.${key}`)
          }
        }
      }
    }

    // Sort the route to make sure all the routers abbr are the same in all the servers
    routes.sort()

    routes.forEach((item, index) => {
      const abbr = index + 1
      this.abbrs[abbr] = item
      this.dict[item] = abbr
    })

    // Load user dictionary
    if (this.userDicPath) {
      const userDic = require(this.userDicPath)

      let abbr = routes.length + 1

      // maybe there is an object
      if (userDic && userDic.length) {
        userDic.forEach((route) => {
          this.abbrs[abbr] = route
          this.dict[route] = abbr
          abbr++
        })
      }
    }

    this.version = crypto.createHash('md5').update(JSON.stringify(this.dict)).digest('base64')

    olemopUtils.invokeCallback(cb)
  }

  getDict () {
    return this.dict
  }

  getAbbrs () {
    return this.abbrs
  }

  getVersion () {
    return this.version
  }
}

module.exports = (app, opts) => {
  return new Component(app, opts)
}
