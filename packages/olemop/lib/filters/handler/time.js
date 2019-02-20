/**
 * Filter for statistics.
 * Record used time for each request.
 */

const conLogger = require('@olemop/logger').getLogger('con-log', __filename)
const utils = require('../../util/utils')

class TimeFilter {
  before (msg, session, next) {
    session.__startTime__ = Date.now()
    next()
  }

  after (err, msg, session, resp, next) {
    const start = session.__startTime__
    if (typeof start === 'number') {
      conLogger.info(JSON.stringify({
        route: msg.__route__,
        args: msg,
        time: utils.format(new Date(start)),
        timeUsed: Date.now() - start
      }))
    }
    next(err)
  }
}

module.exports = () => {
  return new TimeFilter()
}
