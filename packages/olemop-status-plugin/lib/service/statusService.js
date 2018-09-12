const olemoptUtils = require('@olemop/utils')
const DefaultStatusManager = require('../manager/statusManager')
const countDownLatch = require('../util/countDownLatch')

const ST_INITED = 0
const ST_STARTED = 1
const ST_CLOSED = 2

const getStatusManager = (app, opts) => {
  return (typeof opts.statusManager === 'function' ? opts.statusManager(app, opts) : opts.statusManager)
    || new DefaultStatusManager(app, opts)
}

class StatusService {
  constructor (app, opts) {
    this.app = app
    this.opts = opts || {}
    this.cleanOnStartUp = opts.cleanOnStartUp
    this.manager = getStatusManager(app, opts)
    this.state = ST_INITED
  }

  start (cb) {
    const self = this
    if (this.state !== ST_INITED) {
      olemoptUtils.invokeCallback(cb, new Error('invalid state'))
      return
    }
    if (typeof this.manager.start === 'function') {
      this.manager.start((err) => {
        if (!err) {
          self.state = ST_STARTED
        }
        if (self.cleanOnStartUp) {
          self.manager.clean((err) => {
            olemoptUtils.invokeCallback(cb, err)
          })
        } else {
          olemoptUtils.invokeCallback(cb, err)
        }
      })
    } else {
      process.nextTick(() => olemoptUtils.invokeCallback(cb))
    }
  }

  stop (force, cb) {
    this.state = ST_CLOSED
    if (typeof this.manager.stop === 'function') {
      this.manager.stop(force, cb)
    } else {
      process.nextTick(() => olemoptUtils.invokeCallback(cb))
    }
  }

  add (uid, sid, cb) {
    if (this.state !== ST_STARTED) {
      olemoptUtils.invokeCallback(cb, new Error('invalid state'))
      return
    }
    this.manager.add(uid, sid, cb)
  }

  leave (uid, sid, cb) {
    if (this.state !== ST_STARTED) {
      olemoptUtils.invokeCallback(cb, new Error('invalid state'))
      return
    }
    this.manager.leave(uid, sid, cb)
  }

  getSidsByUid (uid, cb) {
    if (this.state !== ST_STARTED) {
      olemoptUtils.invokeCallback(cb, new Error('invalid state'))
      return
    }
    this.manager.getSidsByUid(uid, cb)
  }

  getStatusByUid (uid, cb) {
    if (this.state !== ST_STARTED) {
      olemoptUtils.invokeCallback(cb, new Error('invalid state'))
      return
    }
    this.manager.getSidsByUid(uid, (err, list) => {
      if (err) {
        olemoptUtils.invokeCallback(cb, new Error(`failed to get serverIds by uid: [${uid}], err: ${err.stack}`), null)
        return
      }
      // true=online false=offline
      const status = list !== undefined && list.length >= 1
      olemoptUtils.invokeCallback(cb, null, status)
    })
  }

  getStatusByUids (uids, cb) {
    if (this.state !== ST_STARTED) {
      olemoptUtils.invokeCallback(cb, new Error('invalid state'))
      return
    }
    this.manager.getSidsByUids(uids, (err, replies) => {
      if (err) {
        olemoptUtils.invokeCallback(cb, new Error(`failed to get serverIds by uids, err: ${err.stack}`), null)
        return
      }
      const statuses = {}
      uids.forEach((item, index) => {
        // true=online false=offline
        statuses[item] = replies[index] === 1
      })

      olemoptUtils.invokeCallback(cb, null, statuses)
    })
  }

  pushByUids (uids, route, msg, cb) {
    const self = this
    if (this.state !== ST_STARTED) {
      olemoptUtils.invokeCallback(cb, new Error('invalid state'))
      return
    }
    const channelService = this.app.get('channelService')
    let successFlag = false
    const count = olemoptUtils.size(uids)
    const records = []

    const latch = countDownLatch.createCountDownLatch(count, () => {
      if (!successFlag) {
        olemoptUtils.invokeCallback(cb, new Error(`failed to get sids for uids: ${uids}`), null)
        return
      }
      else {
        if (records != null && records.length != 0){
          channelService.pushMessageByUids(route, msg, records, cb)
        }else{
          olemoptUtils.invokeCallback(cb, null, null)
        }
      }
    })

    uids.forEach((uidItem) => {
      self.getSidsByUid(uidItem, (err, list) => {
        if (err) {
          olemoptUtils.invokeCallback(cb, new Error(`failed to get serverIds by uid: [${uidItem}], err: ${err.stack}`), null)
          return
        }
        list.forEach((item) => {
          records.push({ uid: uidItem, sid: item })
        })

        successFlag = true
        latch.done()
      })
    })
  }
}

module.exports = StatusService
