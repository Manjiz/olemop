/**
 * Module dependencies.
 */

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
  switch (args.length) {
    case 2:
      this.enqueue(args[0],args[1])
      break
    case 3:
    case 4:
      mergerKey = [args[0],args[1]].join('')
      this.mergerMap[mergerKey] = { key: args[0], val: clone(args[2]), cb: args[3] }
      this.writeToAOF(args[0], [args[2]])
      break
  }
}

/**
 * enqueue data
 */
export const enqueue = (key: string, val: object): void => {
  const target = clone(val)
  if (!target) return
  this.writeToAOF(key, [ val ])
  this.flushQueue.push({ key: key, val: val })
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
export const isDone = (): boolean => {
  let writerEmpty = true
  let queueEmpty = false
  let mapEmpty = false
  if (this.rewriter) {
    writerEmpty = this.rewriter.isDone()
  }
  queueEmpty = this.flushQueue.getLength() === 0
  mapEmpty = utils.getMapLength(this.mergerMap) === 0
  return writerEmpty && queueEmpty && mapEmpty
}

/*
 * flush single data to db
 * first remove from cache map
 */
export const flush = (...args) => {
  if (args.length < 3) {
    this.log.error('invaild arguments,flush must have at least 3 arguments')
    return false
  }
  const mergerKey = [ args[0], args[1] ].join('')
  const exists = this.mergerMap[mergerKey]
  if (exists) {
    this.writeToAOF([ args[0], ['_remove'] ].join(''), [ exists ])
    delete this.mergerMap[mergerKey]
  }
  this.writeToAOF(args[0], [ args[2] ])
  return this.rewriter.flush(args[0], args[2], args[3])
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
