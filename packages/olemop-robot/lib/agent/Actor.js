/**
 * I am an actor.
 */

const fs = require('fs')
const vm = require('vm')
const EventEmitter = require('events')
const monitor = require('../monitor/monitor')

class Actor extends EventEmitter {
  constructor ({ script }, id) {
    super()
    this.id = id
    this.script = script
    this.on('start', (action, reqId) => {
      monitor.beginTime(action, this.id, reqId)
    })
    this.on('end', (action, reqId) => {
      monitor.endTime(action, this.id, reqId)
    })
    this.on('incr', (action) => {
      monitor.incr(action)
    })
    this.on('decr', (action) => {
      monitor.decr(action)
    })
  }

  run (vmParams) {
    try {
      vm.runInContext(fs.readFileSync(this.script).toString(), vm.createContext({
        console,
        require,
        actor: this,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        global,
        process,
        ...vmParams
      }))
    } catch (err) {
      console.log(err)
      this.emit('error', err.stack)
    }
  }

  /**
   * clear data
   */
  reset () {
    monitor.clear()
  }

  /**
   * wrap setTimeout
   *
   * @param {Function} fn
   * @param {number} time
   */
  later (fn, time) {
    if (time > 0 && typeof fn === 'function') {
      return setTimeout(fn, time)
    }
  }

  /**
   * wrap setInterval
   * when time is Array, the interval time is thd random number
   * between then
   *
   * @param {Function} fn
   * @param {number} time
   */
  interval (fn, time) {
    switch (typeof time) {
      case 'number':
        if (time > 0)	{
          return setInterval(fn, time)
        }
        break
      case 'object':
        const [start, end] = time
        const time = Math.round(Math.random() * (end - start) + start)
        // @todo 这个 setTimeout 有什么意义
        return setTimeout(() => {
          fn()
          this.interval(fn, time)
        }, time)
      default:
        console.error('wrong argument')
    }
  }

  /**
   * wrap clearTimeout
   *
   * @param {number} timerId
   */
  clean (timerId) {
    // @todo 源码为 clearTimeOut，疑似码误
    clearTimeout(timerId)
  }

  /**
   * encode message
   *
   * @param {number} id
   * @param {Object} msg
   */
  //???
}

module.exports = Actor
