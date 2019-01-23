/**
 * Default mailbox factory
 */

const Mailbox = require('./mailboxes/mqtt-mailbox')
// const Ws2Mailbox = require('./mailboxes/ws2-mailbox')
// const WsMailbox = require('./mailboxes/ws-mailbox')

/**
 * default mailbox factory
 *
 * @param {Object} serverInfo single server instance info, {id, host, port, ...}
 * @param {Object} opts construct parameters
 * @return {Object} mailbox instancef
 */
const create = function (serverInfo, opts) {
	// let mailbox = opts.mailbox || 'mqtt'
	// let Mailbox = null
	// if (mailbox == 'ws') {
	// 	Mailbox = WsMailbox
	// } else if (mailbox == 'ws2') {
	// 	Mailbox = Ws2Mailbox
	// } else if (mailbox == 'mqtt') {
	// 	Mailbox = MqttMailbox
	// }
	return Mailbox.create(serverInfo, opts)
}

module.exports = {
  create
}
