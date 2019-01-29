/**
 * Mock remote service
 */
module.exports = {
	doService (value, cb) {
		cb(null, value + 3)
	}
}
