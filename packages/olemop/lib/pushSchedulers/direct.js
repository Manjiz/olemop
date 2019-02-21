const olemopUtils = require('@olemop/utils')

const Service = function (app, opts = {}) {
  if (!(this instanceof Service)) {
    return new Service(app, opts)
  }
  this.app = app
}

module.exports = Service

Service.prototype.schedule = function (reqId, route, msg, recvs, opts = {}, cb) {
  if (opts.type === 'broadcast') {
    doBroadcast(this, msg, opts.userOptions)
  } else {
    doBatchPush(this, msg, recvs)
  }

  if (cb) {
    process.nextTick(() => {
      olemopUtils.invokeCallback(cb)
    })
  }
}

const doBroadcast = (self, msg, opts) => {
  const channelService = self.app.get('channelService')
  const sessionService = self.app.get('sessionService')

  if (opts.binded) {
    sessionService.forEachBindedSession((session) => {
      if (channelService.broadcastFilter && !channelService.broadcastFilter(session, msg, opts.filterParam)) return
      sessionService.sendMessageByUid(session.uid, msg)
    })
  } else {
    sessionService.forEachSession((session) => {
      if (channelService.broadcastFilter && !channelService.broadcastFilter(session, msg, opts.filterParam)) return
      sessionService.sendMessage(session.id, msg)
    })
  }
}

const doBatchPush = (self, msg, recvs) => {
  const sessionService = self.app.get('sessionService')
  recvs.forEach((item) => {
    sessionService.sendMessage(item, msg)
  })
}
