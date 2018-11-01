/**
 *
 * DataSync Components.
 *
 * DataSync's prototype is based on `commands` under the same directory
 *
 */

import fs from 'fs'
import redis from 'redis'
import commands from './commands'
import Rewriter from './rewriter/Rewriter'
import SyncTimer from './timer/SyncTimer'
import utils from './utils/utils'

interface Options {
  debug?: boolean,
  logger?,

  client?,

  redisOptions?: {
    host?: string,
    port?: number
  },

  mergerMapKey?: string,
  userSetKey?: string,
  flushSetKey?: string,

  mapping?: object,
  mappingPath?: string,

  rewriter?,
  interval?: number,
  timer?,

  aof?: boolean,
  filename?: string
}

export default class DataSync {
  debug: boolean
  logger
  client
  MERGER_MAP_KEY
  USER_SET_KEY
  FLUSH_SET_KEY
  dbs: any[]
  db
  aof: boolean
  interval: number
  mergerMap: object
  filename: string
  stream
  mapping
  rewriter
  timer
  redis
  // inherit method
  loadMapping

  constructor(options: Options = {}) {
    // commands
    Object.assign(this, commands)

    this.dbs = []
    this.selectDB(0)
    this.debug = !!options.debug
    this.logger = options.logger || console
    this.client = options.client
    this.redis = redis.createClient(options.redisOptions)
    this.MERGER_MAP_KEY = options.mergerMapKey
    this.USER_SET_KEY = options.userSetKey
    this.FLUSH_SET_KEY = options.flushSetKey
    if (options.mapping) {
      this.mapping = options.mapping
    } else if (options.mappingPath) {
      this.mapping = this.loadMapping(options.mappingPath)
    }
    this.rewriter = options.rewriter || new Rewriter(this)
    this.interval = options.interval || 60000
    this.timer = options.timer || new SyncTimer()

    this.aof = !!options.aof
    if (this.aof) {
      if (options.filename) {
        this.filename = options.filename
      } else {
        const path = `${process.cwd()}/logs`
        fs.mkdirSync(path)
        this.filename = `${path}/dbsync.log`
      }
      this.stream = fs.createWriteStream(this.filename, { flags: 'a' })
    }
    this.timer.start(this)
  }

  /**
   * Select database at the given `index`.
   *
   * @api private
   * @param {Number} index
   */
  selectDB (index) {
    let db = this.dbs[index]
    if (!db) {
      db = {}
      db.data = {}
      this.dbs[index] = db
    }
    this.db = db
  }

  /**
   * return the first used db
   *
   * @api private
   */
  use () {
    this.selectDB(0)
    const db = this.dbs[0]
    const keys = Object.keys(db)
    const dbkey = keys[0]
    return db[dbkey]
  }

  /**
   * Write the given `cmd`, and `args` to the AOF.
   *
   * @param {String} cmd
   * @param {Array} args
   */
  writeToAOF (cmd, args) {
    if (!this.aof) return
    const op = `*${args.length + 1}\r\n${cmd}\r\n`
    // Write head length
    this.stream.write(op)
    // Write Args
    for (let i = 0; i < args.length; i++) {
      const key = utils.string(args[i])
      this.stream.write(key)
      this.stream.write('\r\n')
    }
  }
}
