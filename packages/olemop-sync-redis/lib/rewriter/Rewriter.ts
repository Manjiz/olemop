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
    server.redis.hgetall(server.MERGER_MAP_KEY, (err, res) => {
      for (let mergerKey in res) {
        const multi = server.redis.multi()
        if (res[mergerKey]) {
          const mergerMapValue = JSON.parse(res[mergerKey])
          // mergerMapValue.mergerKey = mergerKey
          // res is mergerMapValue
          // this.tick(mergerMapValue, (err, res) => {
          this.tick(mergerKey, mergerMapValue, (err, res) => {
            multi.hdel(server.MERGER_MAP_KEY, res.mergerKey)
            if (res.uid) {
              multi.srem(`${server.USER_SET_KEY} ${res.uid}`, res.mergerKey)
            }
            multi.exec((err, res) => { })
          })
        }
      }
    })
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
  tick (key, val, cb?: (err: Error, key, val) => any) {
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
      invoke(syncb, server.client, val, () => { this.count -= 1 })
      return
    }
    invoke(syncb, server.client, val, (err, res) => {
      cb(err, key, val)
    })
  }

  /*
   * judge task is done
   */
  isDone = (): boolean => this.count === 0
}
