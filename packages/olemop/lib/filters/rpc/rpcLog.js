/**
 * Filter for rpc log.
 * Record used time for remote process call.
 */

const rpcLogger = require('@olemop/logger').getLogger('rpc-log', __filename)
const utils = require('../../util/utils')

class RPCLogFilter {
  constructor () {
    this.name = 'rpcLog'
  }

  /**
   * Before filter for rpc
   */
  before (serverId, msg, opts = {}, next) {
    opts.__start_time__ = Date.now()
    next()
  }

  /**
   * After filter for rpc
   */
  after (serverId, msg, opts, next) {
    if (opts && opts.__start_time__) {
      const start = opts.__start_time__
      rpcLogger.info(JSON.stringify({
        route: msg.service,
        args: msg.args,
        time: utils.format(new Date(start)),
        timeUsed: Date.now() - start
      }))
    }
    next()
  }
}

module.exports = () => {
  return new RPCLogFilter()
}
