/**
 * Filter for toobusy.
 * if the process is toobusy, just skip the new request
 */

const conLogger = require('@olemop/logger').getLogger('con-log', __filename)

const DEFAULT_MAXLAG = 70

let toobusy = null

class TooBusyFilter {
  constructor (maxLag = DEFAULT_MAXLAG) {
    try {
      toobusy = require('toobusy')
    } catch (e) {}
    if (toobusy) {
      toobusy.maxLag(maxLag)
    }
  }

  before (msg, session, next) {
    if (toobusy && toobusy()) {
      conLogger.warn(`[toobusy] reject request msg: ${msg}`)
      const err = new Error('Server toobusy!')
      err.code = 500
      next(err)
    } else {
      next()
    }
  }
}

module.exports = (maxLag) => {
  return new TooBusyFilter(maxLag)
}
