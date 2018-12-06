/**
 *
 * DataSync Components.
 *
 * DataSync's prototype is based on `commands` under the same directory
 *
 */

import fs from 'fs'
import path from 'path'
import redis from 'redis'
import Rewriter from './rewriter/Rewriter'
import SyncTimer from './timer/SyncTimer'
import utils from './utils/utils'

const clone = utils.clone

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

  constructor(options: Options = {}) {
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
   * ==================================================
   *
   *  Commands: Mapping
   *
   * ==================================================
   */
  loadMapping = (mappingPath: string) => {
    const mapping = {}
    mappingPath += '/'

    this.debug && this.logger.info(`[data sync compoment] load mapping file ${mappingPath}`)

    fs.readdirSync(mappingPath).forEach((filename) => {
      if (!/\.js$/.test(filename)) return
      const name = path.basename(filename, '.js')
      const fullPath = mappingPath + name

      this.debug && this.logger.log(`loading ${fullPath}`)

      const pro = require(fullPath)

      for (let key in pro) {
        const fullKey = `${name}.${key}`
        if (mapping[fullKey]) {
          this.debug && this.logger.error(`[data sync component] exist duplicated key map function ${key} ignore it now.`)
        } else {
          mapping[fullKey] = pro[key]
        }
      }
    })
    this.debug && this.logger.info('[data sync component] load mapping file done.' )
    return mapping
  }

  /**
   * ==================================================
   *
   *  Commands: Server
   *
   * ==================================================
   */

  /**
   * invoke tick instant
   */
  execSync = (key: string, val: object, cb: () => any) => {
    this.rewriter.tick(key, val, cb)
  }

  /**
   * exec add be synced data to queue
   * invoke by timer
   * @example ('ojbk', 123)
   * @example ('player', 'Info', '{"id":1,"nickname":"Jenny"}')
   */
  exec = (...args) => {
    let mergerKey
    let cb = args[args.length - 1]
    let argsLength = args.length
    if (typeof cb !== 'function') {
      cb = null
      // add pseudo callback when the last argument is not a callback
      argsLength += 1
    }
    switch (argsLength) {
      // 暂未支持3
      case 3:
        this.redis.sadd(this.FLUSH_SET_KEY, JSON.stringify({ key: args[0], val: clone(args[1]) }), cb)
        break
      case 4:
        mergerKey = [ args[0], args[1] ].join('')
        this.redis.hset(this.MERGER_MAP_KEY, mergerKey, JSON.stringify({ key: args[0], val: clone(args[2]) }), cb)
        break
      // 暂不支持5
      case 5:
        mergerKey = [ args[0], args[1], args[2] ].join('')
        const multi = this.redis.multi()
        multi.hset(this.MERGER_MAP_KEY, mergerKey, JSON.stringify({
          key: args[0],
          uid: args[1],
          val: clone(args[3])
        }))
        multi.sadd(`${this.USER_SET_KEY} ${args[1]}`, mergerKey)
        multi.exec(cb)
        break
      default:
        cb(new Error('exec function at least have 3 argument'))
    }
  }

  /**
   * flush all data go head
   */
  sync = (): void => {
    if (!this.rewriter) return
    this.rewriter.sync(this)
  }

  /**
   * reutrn queue is empty or not when shutdown server
   */
  isDone = (cb: (err: Error, isDone: boolean) => any): void => {
    let writerEmpty = true
    let mapEmpty = false
    if (this.rewriter) {
      writerEmpty = this.rewriter.isDone()
    }
    const multi = this.redis.multi()
    multi.hlen(this.MERGER_MAP_KEY)
    // multi.this.scard(this.USER_SET_KEY)
    multi.exec((err, replies) => {
      mapEmpty = replies[0] === 0
      cb(err, writerEmpty && mapEmpty)
    })
  }

  /*
  * flush single data to db
  * first remove from cache map
  */
  flush = (...args) => {
    let mergerKey
    const cb = args[args.length - 1]
    const flushArguments = args
    if (typeof cb !== 'function') {
      console.error('the last argument must be callback function!')
      console.error('from flush :' + args[0])
      return
    }
    switch (args.length) {
      case 4:
        mergerKey = [ args[0], args[1] ].join('')
        this.redis.hdel(this.MERGER_MAP_KEY, mergerKey, (err, res) => {
          this.rewriter.flush(flushArguments[0], flushArguments[2], cb)
        })
        break
      case 5:
        mergerKey = [ args[0], args[1] ].join('')
        const multi = this.redis.multi()
        multi.hdel(this.MERGER_MAP_KEY, mergerKey)
        multi.srem(`${this.USER_SET_KEY} ${args[1]}`, mergerKey)
        multi.exec((err, res) => {
          this.rewriter.flush(flushArguments[0], flushArguments[3], cb)
        })
        break
      default:
        cb(new Error('exec function at least have 4 argument'))
    }
  }

  flushByUid = (...args) => {
    var cb = args[args.length - 1]
    if (typeof cb !== 'function') {
      console.error('the last argument must be callback function!')
      console.error('from flush by uid :' + args[0])
    }
    // userKeyMap
    this.redis.smembers(`${this.USER_SET_KEY} ${args[0]}`, (err, mergerKeys) => {
      this.redis.hmget(this.MERGER_MAP_KEY, mergerKeys, (err, res) => {
        if (!res) {
          cb(err, res)
          return
        }
        for (let i = 0; i < res.length; i++) {
          if (!res[i]) continue
          const multi = this.redis.multi()
          const mergerMapValue = JSON.parse(res[i])
          mergerMapValue.mergerKey = mergerKeys[i]
          // res is mergerMapValue
          this.rewriter.tick(mergerMapValue, (err, key, val) => {
            multi.hdel(this.MERGER_MAP_KEY, key)
            if (val) {
              multi.srem(`${this.USER_SET_KEY} ${val}`, key)
            }
            multi.exec((err, res) => { })
          })
        }
        cb(err, res)
      })
    })
  }

  /**
   * get dbsync info INFO
   */
  info = () => {
    let buf = ''
    this.dbs.forEach((db, i) => {
      const len = Object.keys(db).length
      if (len) {
        buf = `${buf}db${i}:keys=${len},expires=0\r\n`
      }
    })
    return buf
  }
}
