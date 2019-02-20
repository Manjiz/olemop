const utils = require('../util/utils')

const DEFAULT_FLUSH_INTERVAL = 20

const Service = function (app, opts = {}) {
  if (!(this instanceof Service)) {
    return new Service(app, opts)
  }

  this.app = app
  this.flushInterval = opts.flushInterval || DEFAULT_FLUSH_INTERVAL
  // sid -> msg queue
  this.sessions = {}
  this.tid = null
}

module.exports = Service

Service.prototype.start = function (cb) {
  this.tid = setInterval(flush.bind(null, this), this.flushInterval)
  process.nextTick(() => {
    utils.invokeCallback(cb)
  })
}

Service.prototype.stop = function (force, cb) {
  if (this.tid) {
    clearInterval(this.tid)
    this.tid = null
  }
  process.nextTick(() => {
    utils.invokeCallback(cb)
  })
}

Service.prototype.schedule = function (reqId, route, msg, recvs, opts = {}, cb) {
  if (opts.type === 'broadcast') {
    doBroadcast(this, msg, opts.userOptions)
  } else {
    doBatchPush(this, msg, recvs)
  }

  process.nextTick(() => {
    utils.invokeCallback(cb)
  })
}

const doBroadcast = (self, msg, opts) => {
  const channelService = self.app.get('channelService')
  const sessionService = self.app.get('sessionService')

  if (opts.binded) {
    sessionService.forEachBindedSession((session) => {
      if (channelService.broadcastFilter && !channelService.broadcastFilter(session, msg, opts.filterParam)) return
      enqueue(self, session, msg)
    })
  } else {
    sessionService.forEachSession((session) => {
      if (channelService.broadcastFilter && !channelService.broadcastFilter(session, msg, opts.filterParam)) return
      enqueue(self, session, msg)
    })
  }
}

const doBatchPush = (self, msg, recvs) => {
  const sessionService = self.app.get('sessionService')
  recvs.forEach((item) => {
    const session = sessionService.get(item)
    if (session) {
      enqueue(self, session, msg)
    }
  })
}

const enqueue = (self, session, msg) => {
  let queue = self.sessions[session.id]
  if (!queue) {
    queue = self.sessions[session.id] = []
    session.once('closed', onClose.bind(null, self))
  }
  queue.push(msg)
}

const onClose = (self, session) => {
  delete self.sessions[session.id]
}

const flush = (self) => {
  const sessionService = self.app.get('sessionService')
  for (let sid in self.sessions) {
    const session = sessionService.get(sid)
    if (!session) continue
    const queue = self.sessions[sid]
    if (!queue || queue.length === 0) continue
    session.sendBatch(queue)
    self.sessions[sid] = []
  }
}
