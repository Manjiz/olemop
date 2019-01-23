const fs = require('fs')
const util = require('util')
const EventEmitter = require('events')
const Loader = require('@olemop/loader')
const defaultAcceptorFactory = require('./acceptor')
const Dispatcher = require('./dispatcher')

const watchServices = (gateway, dispatcher) => {
  const paths = gateway.opts.paths
  const app = gateway.opts.context
  paths.forEach((item) => {
    fs.watch(item.path, (event) => {
      if (event === 'change') {
        const res = {}
        const m = Loader.load(item.path, app)
        if (m) {
          res[item.namespace] = res[item.namespace] || {}
          Object.keys(m).forEach((key) => {
            res[item.namespace][key] = m[key]
          })
        }
        dispatcher.emit('reload', res)
      }
    })
  })
}

const Gateway = function (opts) {
  EventEmitter.call(this)
  this.opts = opts || {}
  this.port = opts.port || 3050
  this.started = false
  this.stoped = false
  this.acceptorFactory = opts.acceptorFactory || defaultAcceptorFactory
  this.services = opts.services
  const dispatcher = new Dispatcher(this.services)
  if (this.opts.reloadRemotes) {
    watchServices(this, dispatcher)
  }
  this.acceptor = this.acceptorFactory.create(opts, function (tracer, msg, cb) {
    dispatcher.route(tracer, msg, cb)
  })
}

util.inherits(Gateway, EventEmitter)

Gateway.prototype.stop = function () {
  if (!this.started || this.stoped) {
    return
  }
  this.stoped = true
  try {
    this.acceptor.close()
  } catch (err) {}
}

Gateway.prototype.start = function () {
  if (this.started) {
    throw new Error('gateway already start.')
  }
  this.started = true

  this.acceptor.on('error', this.emit.bind(this, 'error'))
  this.acceptor.on('closed', this.emit.bind(this, 'closed'))
  this.acceptor.listen(this.port)
}

/**
 * create and init gateway
 *
 * @param opts {services: {rpcServices}, connector:conFactory(optional), router:routeFunction(optional)}
 */
module.exports.create = function (opts) {
  if (!opts || !opts.services) {
    throw new Error('opts and opts.services should not be empty.')
  }

  return new Gateway(opts)
}
