export default class SyncTimer {
  start (db) {
    setInterval(() => {
      db.sync()
    }, db.interval)
  }
}
