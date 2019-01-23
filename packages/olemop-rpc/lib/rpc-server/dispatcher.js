const EventEmitter = require('events')
const util = require('util')

const Dispatcher = function (services) {
  EventEmitter.call(this)
  this.on('reload', (services) => {
    this.services = services
  })
  this.services = services
}

util.inherits(Dispatcher, EventEmitter)

/**
 * route the msg to appropriate service object
 *
 * @param msg msg package {service:serviceString, method:methodString, args:[]}
 * @param services services object collection, such as {service1: serviceObj1, service2: serviceObj2}
 * @param cb(...) callback function that should be invoked as soon as the rpc finished
 */
Dispatcher.prototype.route = function (tracer, msg, cb) {
  tracer && tracer.info('server', __filename, 'route', 'route messsage to appropriate service object')
  const namespace = this.services[msg.namespace]
  if (!namespace) {
    tracer && tracer.error('server', __filename, 'route', `no such namespace: ${msg.namespace}`)
    cb(new Error(`no such namespace: ${msg.namespace}`))
    return
  }

  const service = namespace[msg.service]
  if (!service) {
    tracer && tracer.error('server', __filename, 'route', `no such service: ${msg.service}`)
    cb(new Error(`no such service: ${msg.service}`))
    return
  }

  const method = service[msg.method]
  if (!method) {
    tracer && tracer.error('server', __filename, `route', 'no such method: ${msg.method}`)
    cb(new Error(`no such method: ${msg.method}`))
    return
  }

  const args = msg.args
  args.push(cb)
  method.apply(service, args)
}

module.exports = Dispatcher
