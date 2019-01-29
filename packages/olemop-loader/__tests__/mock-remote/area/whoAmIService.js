/**
 * Mock remote service
 */

module.exports = (app) => {
	return {
		doService (cb) {
			cb(null, app.id)
		},
		name: 'whoAmIRemote'
	}
}
