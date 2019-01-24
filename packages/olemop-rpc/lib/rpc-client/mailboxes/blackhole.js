const EventEmitter = require('events')
const logger = require('@olemop/logger').getLogger('olemop-rpc', 'blackhole')

const emitter = new EventEmitter()

emitter.connect = (tracer, cb) => {
	tracer && tracer.info('client', __filename, 'connect', 'connect to blackhole')
	process.nextTick(() => {
		cb(new Error('fail to connect to remote server and switch to blackhole.'))
	})
}

emitter.close = (cb) => {}

emitter.send = (tracer, msg, opts, cb) => {
	tracer && tracer.info('client', __filename, 'send', 'send rpc msg to blackhole')
	logger.info('message into blackhole: %j', msg)
	process.nextTick(() => {
		cb(tracer, new Error('message was forward to blackhole.'))
	})
}

module.exports = emitter
