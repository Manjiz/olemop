const utils = require('../utils/utils')
const invoke = utils.invoke

export default class Rewriter {
  server
  count: number = 0

  /**
   * Initialize a new AOF Rewriter with the given `db`.
   * @param {options}
   */
  constructor (server) {
    this.server = server
  }

  /**
   * Initiate sync.
   */
  sync = () => {
    const server = this.server
    server.flushQueue.shiftEach((element) => {
      this.tick(element.key, element.val)
    })
    const mergerMap = server.mergerMap
    for (let mergerKey in mergerMap){
      const entry = mergerMap[mergerKey]
      this.tick(entry.key, entry.val, entry.cb)
      delete mergerMap[mergerKey]
    }
    return true
  }

  /*
   * flush db
   */
  flush (key, val, cb) {
    this.tick(key, val, cb)
  }

  /*
   * judge task is done
   */
  tick (key, val, cb?: () => any) {
    const server = this.server
    if (!server.client){
      server.log.error('db sync client is null')
      return
    }
    const syncb = server.mapping[key]
    if (!syncb) {
      server.log.error(`${key} callback function not exist `)
      return
    }
    if (!cb) {
      this.count += 1
      return invoke(syncb, server.client, val, () => { this.count -= 1 })
    }
    invoke(syncb, server.client, val, cb)
  }

  /*
   * judge task is done
   */
  isDone = (): boolean => this.count === 0
}
