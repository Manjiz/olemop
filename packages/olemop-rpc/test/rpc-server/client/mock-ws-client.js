var sioClient = require('socket.io-client')
var EventEmitter = require('events')
var util = require('util')
var utils = require('../../../lib/util/utils')

var Client = function () {
  EventEmitter.call(this)
  this.requests = {}
  this.curId = 0
}
util.inherits(Client, EventEmitter)

var pro = Client.prototype

pro.connect = function (host, port, cb) {
  this.socket = sioClient.connect(host + ':' + port, {'force new connection': true})

  this.socket.on('message', (pkg) => {
    var cb = this.requests[pkg.id]
    delete this.requests[pkg.id]

    if (!cb) {
      return
    }

    cb.apply(null, pkg.resp)
  })

  this.socket.on('connect', () => {
    utils.invokeCallback(cb)
  })
}

pro.send = function (msg, cb) {
  var id = this.curId++
  this.requests[id] = cb
  this.socket.emit('message', {id: id, msg: msg})
}

pro.close = function () {
  this.socket.disconnect()
}

module.exports.create = function (opts) {
  return new Client()
}
