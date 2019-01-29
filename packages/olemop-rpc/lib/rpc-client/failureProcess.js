const logger = require('@olemop/logger').getLogger('olemop-rpc', 'failprocess')
const constants = require('../util/constants')

/**
 * Failover rpc failure process. This will try other servers with option retries.
 *
 * @param code {Number} error code number.
 * @param tracer {Object} current rpc tracer.
 * @param serverId {string} rpc remote target server id.
 * @param msg {Object} rpc message.
 * @param opts {Object} rpc client options.
 * @param cb {Function} user rpc callback.
 */
const failover = function (code, tracer, serverId, msg, opts, cb) {
  const serverType = msg.serverType
  const servers = !tracer || !tracer.servers ? this.serversMap[serverType] : tracer.servers

	const index = servers.indexOf(serverId)
	if (index >= 0) {
		servers.splice(index, 1)
	}
	tracer && (tracer.servers = servers)

	if (!servers.length) {
		logger.error(`[olemop-rpc] rpc failed with all this type of servers, with serverType: ${serverType}`)
		cb(new Error(`rpc failed with all this type of servers, with serverType: ${serverType}`))
		return
	}
	this.dispatch.call(this, tracer, servers[0], msg, opts, cb)
}

/**
 * Failsafe rpc failure process.
 *
 * @param code {Number} error code number.
 * @param tracer {Object} current rpc tracer.
 * @param serverId {string} rpc remote target server id.
 * @param msg {Object} rpc message.
 * @param opts {Object} rpc client options.
 * @param cb {Function} user rpc callback.
 */
const failsafe = function (code, tracer, serverId, msg, opts, cb) {
	const retryTimes = opts.retryTimes || constants.DEFAULT_PARAM.FAILSAFE_RETRIES
	const retryConnectTime = opts.retryConnectTime || constants.DEFAULT_PARAM.FAILSAFE_CONNECT_TIME
	if (!tracer.retryTimes) {
		tracer.retryTimes = 1
	} else {
		tracer.retryTimes += 1
  }
	switch (code) {
		case constants.RPC_ERROR.SERVER_NOT_STARTED:
		case constants.RPC_ERROR.NO_TRAGET_SERVER:
			cb(new Error('rpc client is not started or cannot find remote server.'))
			break
		case constants.RPC_ERROR.FAIL_CONNECT_SERVER:
			if (tracer.retryTimes <= retryTimes) {
				setTimeout(() => {
					this.connect(tracer, serverId, cb)
				}, retryConnectTime * tracer.retryTimes)
			} else {
				cb(new Error(`rpc client failed to connect to remote server: ${serverId}`))
			}
			break
		case constants.RPC_ERROR.FAIL_FIND_MAILBOX:
		case constants.RPC_ERROR.FAIL_SEND_MESSAGE:
			if (tracer.retryTimes <= retryTimes) {
				setTimeout(() => {
					this.dispatch.call(this, tracer, serverId, msg, opts, cb)
				}, retryConnectTime * tracer.retryTimes)
			} else {
				cb(new Error(`rpc client failed to send message to remote server: ${serverId}`))
			}
			break
		case constants.RPC_ERROR.FILTER_ERROR:
			cb(new Error('rpc client filter encounters error.'))
			break
		default:
			cb(new Error('rpc client unknown error.'))
	}
}

/**
 * Failback rpc failure process. This will try the same server with sendInterval option and retries option.
 *
 * @param code {Number} error code number.
 * @param tracer {Object} current rpc tracer.
 * @param serverId {string} rpc remote target server id.
 * @param msg {Object} rpc message.
 * @param opts {Object} rpc client options.
 * @param cb {Function} user rpc callback.
 */
const failback = function (code, tracer, serverId, msg, opts, cb) {
	// todo record message in background and send the message at timing
}

/**
 * Failfast rpc failure process. This will ignore error in rpc client.
 *
 * @param code {Number} error code number.
 * @param tracer {Object} current rpc tracer.
 * @param serverId {string} rpc remote target server id.
 * @param msg {Object} rpc message.
 * @param opts {Object} rpc client options.
 * @param cb {Function} user rpc callback.
 */
const failfast = function (code, tracer, serverId, msg, opts, cb) {
	logger.error('rpc failed with error, remote server: %s, msg: %j, error code: %s', serverId, msg, code)
	cb && cb(new Error(`rpc failed with error code: ${code}`))
}

module.exports = function (code, tracer, serverId, msg, opts) {
	const cb = tracer && tracer.cb
	const mode = opts.failMode
	const FAIL_MODE = constants.FAIL_MODE
	let method = failfast

	switch (mode) {
		case FAIL_MODE.FAILOVER:
			method = failover
			break
		case FAIL_MODE.FAILBACK:
			method = failback
			break
		// case FAIL_MODE.FAILFAST:
		// 	method = failfast
		// 	break
		// case FAIL_MODE.FAILSAFE:
		// default:
		// 	method = failfast
	}
	method.call(this, code, tracer, serverId, msg, opts, cb)
}
