/**
 *
 * DataSync Components.
 *
 * DataSync's prototype is based on `commands` under the same directory
 *
 */

import fs from 'fs'
import Commands from './commands'
import Rewriter from '../lib/rewriter/Rewriter'
import SyncTimer from '../lib/timer/Synctimer'
import Queue from './utils/Queue'
import utils from './utils/utils'

interface Options {
  debug?: boolean,
  client?,
  aof?: boolean,
  log?,
  interval?: number,
  filename?: string,
  mapping?,
  mappingPath?: string,
  rewriter?,
  timer?
}

export default class DataSync extends Commands {
  debug: boolean
  dbs: any[]
  db
  client
  aof: boolean
  log
  interval: number
  flushQueue: Queue
  mergerMap: object
  filename: string
  stream
  mapping
  rewriter: Rewriter
  timer: SyncTimer
  // inherit method
  loadMapping

  constructor (options: Options = {}) {
    super()
    this.dbs = []
    this.selectDB(0)
    this.debug = !!options.debug
    this.client = options.client
    this.aof = !!options.aof
    this.log = options.log || console
    this.interval = options.interval || 1000 * 60
    this.flushQueue =  new Queue()
    this.mergerMap = {}
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
    if (options.mapping) {
      this.mapping = options.mapping
    } else if (options.mappingPath) {
      this.mapping = this.loadMapping(options.mappingPath)
    }
    this.rewriter = options.rewriter || new Rewriter(this)
    this.timer = options.timer || new SyncTimer()
    this.timer.start(this)
  }

  /**
   * Select database at the given `index`.
   *
   * @api private
   * @param {number} index
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
   * Lookup `key`, when volatile compare timestamps to
   * expire the key.
   *
   * @param {string} key
   * @return {Object}
   */
  lookup (key) {
    const obj = this.db.data[key]
    if (!obj || typeof obj.expires !== 'number' || obj.expires >= Date.now()) return obj
    delete this.db.data[key]
  }

  /**
   * Write the given `cmd`, and `args` to the AOF.
   *
   * @param {string} cmd
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
