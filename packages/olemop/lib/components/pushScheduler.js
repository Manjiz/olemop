/**
 * Scheduler component to schedule message sending.
 */

const logger = require('@olemop/logger').getLogger('olemop', __filename)
const DefaultScheduler = require('../pushSchedulers/direct')

const getScheduler = (pushSchedulerComp, app, opts) => {
  const scheduler = opts.scheduler || DefaultScheduler
  if (typeof scheduler === 'function') {
    return scheduler(app, opts)
  }

  if (Array.isArray(scheduler)) {
    const res = {}
    scheduler.forEach((sch) => {
      res[sch.id] = typeof sch.scheduler === 'function' ? sch.scheduler(app, sch.options) : sch.scheduler
    })
    pushSchedulerComp.isSelectable = true
    pushSchedulerComp.selector = opts.selector
    return res
  }

  return scheduler
}

class PushScheduler {
  constructor(app, opts) {
    this.name = '__pushScheduler__'
    this.app = app
    opts = opts || {}
    this.scheduler = getScheduler(this, app, opts)
  }

  /**
   * Component lifecycle callback
   *
   * @param {Function} cb
   */
  afterStart (cb) {
    if (this.isSelectable) {
      for (let k in this.scheduler) {
        const sch = this.scheduler[k]
        if (typeof sch.start === 'function') {
          sch.start()
        }
      }
      process.nextTick(cb)
    } else if (typeof this.scheduler.start === 'function') {
      this.scheduler.start(cb)
    } else {
      process.nextTick(cb)
    }
  }

  /**
   * Component lifecycle callback
   *
   * @param {Function} cb
   * @returns {Void}
   */
  stop (force, cb) {
    if (this.isSelectable) {
      for (let k in this.scheduler) {
        const sch = this.scheduler[k]
        if (typeof sch.stop === 'function') {
          sch.stop()
        }
      }
      process.nextTick(cb)
    } else if (typeof this.scheduler.stop === 'function') {
      this.scheduler.stop(cb)
    } else {
      process.nextTick(cb)
    }
  }

  /**
   * Schedule how the message to send.
   *
   * @param  {number}   reqId request id
   * @param {string}   route route string of the message
   * @param  {Object}   msg   message content after encoded
   * @param  {Array}    recvs array of receiver's session id
   * @param  {Object}   opts  options
   * @param  {Function} cb
   */
  schedule (reqId, route, msg, recvs, opts, cb) {
    if (this.isSelectable) {
      if (typeof this.selector === 'function') {
        this.selector(reqId, route, msg, recvs, opts, (id) => {
          if (this.scheduler[id] && typeof this.scheduler[id].schedule === 'function') {
            this.scheduler[id].schedule(reqId, route, msg, recvs, opts, cb)
          } else {
            logger.error('invalid pushScheduler id, id: %j', id)
          }
        })
      } else {
        logger.error('the selector for pushScheduler is not a function, selector: %j', this.selector)
      }
    } else {
      if (typeof this.scheduler.schedule === 'function') {
        this.scheduler.schedule(reqId, route, msg, recvs, opts, cb)
      } else {
        logger.error('the scheduler does not have a schedule function, scheduler: %j', this.scheduler)
      }
    }
  }
}

module.exports = (app, opts) => {
  return new PushScheduler(app, opts)
}
