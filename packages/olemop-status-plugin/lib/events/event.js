const logger = require('@olemop/logger').getLogger(__filename)

class Event {
  constructor (app) {
    this.app = app
    this.statusService = app.get('statusService')
  }

  bind_session (session) {
    if (!session.uid) return
    this.statusService.add(session.uid, session.frontendId, (err) => {
      if (err) {
        logger.error(`statusService add user failed: [${session.uid}] [${session.frontendId}], err: ${err}`)
        return
      }
    })
  }

  close_session (session) {
    if (!session.uid) return
    // don't remove entry if another session for the same user on the same frontend remain
    const currentUserSessions = this.app.get('sessionService').getByUid(session.uid)
    if (currentUserSessions !== undefined) {
      logger.debug(`at least another session exists for this user on this frontend: [${session.uid}] [${session.frontendId}]`)
      return
    }
    this.statusService.leave(session.uid, session.frontendId, (err) => {
      if (err) {
        logger.error(`failed to kick user in statusService: [${session.uid}] [${session.frontendId}], err: ${err}`)
        return
      }
    })
  }
}

module.exports = Event
