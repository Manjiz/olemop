const Agent = require('./agent/Agent')
const Server = require('./master/Server')
const httpServer = require('./console/httpServer')
const util = require('./common/util')

util.createPath()

/**
 * export to developer prototype
 *
 * @param {Object} config
 * include deal with master and agent mode
 *
 * param include mode
 */
class Robot {
  constructor (conf) {
    this.conf = conf
    this.master = null
    this.agent = null
  }

  /**
   * run master server
   *
   * @param {string} start up file
   */
  runMaster (mainFile) {
    this.master = new Server({
      mainFile,
      ...this.conf
    })
    this.master.listen(this.conf.master.port)
    httpServer.start(this.conf.master.webport)
  }

  /**
   * run agent client
   *
   * @param {string} script
   */
  runAgent (script) {
    this.agent = new Agent({
      script,
      ...this.conf
    })
    this.agent.start()
  }

  restart () {
    if (this.agent) {
      this.agent.reconnect(true)
    }
  }
}

module.exports = Robot
