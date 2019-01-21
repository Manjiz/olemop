
import fs from 'fs'

interface Server {
  use(): any,
  mapping(key: string, val: any): any,
  queue: any
}

export default class FileRewriter {
  server: Server
  //+ (Math.random() * 0xfffffff | 0)
  filename: string = `${process.cwd()}/logs/dump.db`
  streams: any
  filter?(key: string): any

  /**
   * Initialize a new AOF FileRewriter with the given `db`.
   */
  constructor (server: Server, options: { filter?(key: string): any }) {
    this.server = server
    this.streams = fs.createWriteStream(this.filename, { flags: 'w' })
    this.filter = options.filter || null
  }

  /**
   * Initiate sync.
   */
  sync () {
    const db = this.server.use()
    for (let key in db) {
      if (this.filter && !this.filter(key)) continue
      const val = db[key]
      this.server.mapping ? this.server.mapping(key, val) : this.aof(key,val)
    }
    //this.server.queue.shiftEach(function (key){})
    //this.end()
  }

  /**
   * Close tmpfile streams, and replace AOF
   * will our tempfile, then callback `fn(err)`.
   */
  end (fn) {
    this.streams.end()
  }

  /**
   * Write key / val.
   */
  aof (key: string, val: any) {
    const type = val.type || 'string'
    return this[type](key, val)
  }

  /**
   * Write string to `streams`.
   */
  string (key: string, val: any) {
    this.streams.write(`$${key.length}\r\n`)
    this.streams.write(key)
    this.streams.write('\r\n')
    this.streams.write(JSON.stringify(val))
    this.streams.write('\r\n')
  }

  hash (key: string, val: any) {
    this.string(key,val)
  }
}
