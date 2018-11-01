import utils from '../utils/utils'

const clone = utils.clone

/**
 * invoke tick instant
 */
export const execSync = (key: string, val: object, cb: () => any) => {
  this.rewriter.tick(key, val, cb)
}

/**
 * exec add be synced data to queue
 * invoke by timer
 */
 export const exec = (...args) => {
  let mergerKey
  let cb = args[args.length - 1]
  let argsLength = args.length
  if (typeof cb !== 'function') {
    cb = null
    // add pseudo callback when the last argument is not a callback
    argsLength += 1
  }
  switch (argsLength) {
    case 3:
      // no mergerKey
      this.redis.sadd(this.FLUSH_SET_KEY, JSON.stringify({
        key: args[0],
        val: clone(args[1])
      }), cb)
      break
    case 4:
      mergerKey = [ args[0], args[1] ].join('')
      this.redis.hset(this.MERGER_MAP_KEY, mergerKey, JSON.stringify({
        key: args[0],
        val: clone(args[2])
      }), cb)
      break
    case 5:
      mergerKey = [ args[0], args[1], args[2] ].join('')
      var multi = this.redis.multi()
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
export const sync = (): void => {
  if (!this.rewriter) return
  this.rewriter.sync(this)
}

/**
 * reutrn queue is empty or not when shutdown server
 */
export const isDone = (cb: (err: Error, isDone: boolean) => any): void => {
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
export const flush = (...args) => {
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

export const flushByUid = (...args) => {
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
        this.rewriter.tick(mergerMapValue, (err, res) => {
          multi.hdel(this.MERGER_MAP_KEY, res.mergerKey)
          if (res.uid) {
            multi.srem(`${this.USER_SET_KEY} ${res.uid}`, res.mergerKey)
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
export const info = () => {
  let buf = ''
  this.dbs.forEach((db, i) => {
    const len = Object.keys(db).length
    if (len) {
      buf = `${buf}db${i}:keys=${len},expires=0\r\n`
    }
  })
  return buf
}
