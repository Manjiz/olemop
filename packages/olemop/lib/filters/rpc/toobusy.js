/**
 * Filter for rpc log.
 * Reject rpc request when toobusy
 */

const rpcLogger = require('@olemop/logger').getLogger('rpc-log', __filename)

const DEFAULT_MAXLAG = 70

let toobusy = null

class TooBusyFilter {
  constructor (maxLag= DEFAULT_MAXLAG) {
    this.name = 'toobusy'
    try {
      toobusy = require('toobusy')
    } catch (e) {}
    if (toobusy) {
      toobusy.maxLag(maxLag)
    }
  }

  /**
   * Before filter for rpc
   */
  before (serverId, msg, opts = {}, next) {
    if (toobusy && toobusy()) {
      rpcLogger.warn(`Server too busy for rpc request, serverId: ${serverId} msg: ${msg}`)
      const err =  new Error(`Backend server ${serverId} is too busy now!`)
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
