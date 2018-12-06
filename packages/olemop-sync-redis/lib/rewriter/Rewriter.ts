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
    server.redis.hgetall(server.MERGER_MAP_KEY, (err, replies) => {
      for (let mergerKey in replies) {
        const multi = server.redis.multi()
        if (!replies[mergerKey]) continue
        const mergerMapValue = JSON.parse(replies[mergerKey])
        this.tick(mergerKey, mergerMapValue, (err, key, val) => {
          multi.hdel(server.MERGER_MAP_KEY, key)
          if (val) {
            multi.srem(`${server.USER_SET_KEY} ${val}`, key)
          }
          multi.exec((err, res) => { })
        })
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

  /**
   * 执行数据库更新
   * @param key mapping 键
   * @param val 调用 mapping[key] 的第二个入参
   * @param cb
   */
  tick (key: string, val: any, cb?: (err: Error, key: string, val: any) => any) {
    const server = this.server
    if (!server.client) {
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
      invoke(syncb, server.client, val, (err) => { this.count -= 1 })
      return
    }
    invoke(syncb, server.client, val, (err) => {
      cb(err, key, val)
    })
  }

  /*
   * judge task is done
   */
  isDone = (): boolean => this.count === 0
}
