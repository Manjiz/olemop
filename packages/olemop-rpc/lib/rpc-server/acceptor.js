const acceptor = require('./acceptors/mqtt-acceptor')
// const acceptor = require('./acceptors/ws2-acceptor')

module.exports.create = function (opts, cb) {
	return acceptor.create(opts, cb)
}
