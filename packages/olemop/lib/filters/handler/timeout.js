/**
 * Filter for timeout.
 * Print a warn information when request timeout.
 */

const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)

const DEFAULT_TIMEOUT = 3000
const DEFAULT_SIZE = 500

class TimeoutFilter {
  constructor (timeout = DEFAULT_TIMEOUT, maxSize = DEFAULT_SIZE) {
    this.timeout = timeout
    this.maxSize = maxSize
    this.timeouts = {}
    this.curId = 0
  }

  before (msg, session, next) {
    const count = olemopUtils.size(this.timeouts)
    if (count > this.maxSize) {
      logger.warn(`timeout filter is out of range, current size is ${count}, max size is ${this.maxSize}`)
      next()
      return
    }
    this.curId++
    this.timeouts[this.curId] = setTimeout(() => {
      logger.error('request %j timeout.', msg.__route__)
    }, this.timeout)
    session.__timeout__ = this.curId
    next()
  }

  after (err, msg, session, resp, next) {
    const timeout = this.timeouts[session.__timeout__]
    if (timeout) {
      clearTimeout(timeout)
      delete this.timeouts[session.__timeout__]
    }
    next(err)
  }
}

module.exports = (timeout, maxSize) => {
  return new TimeoutFilter(timeout, maxSize)
}
