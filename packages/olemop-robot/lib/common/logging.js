/**
 * Generic logging module.
 *
 * Log Levels:
 * - 3 (Debug)
 * - 2 (Info)
 * - 1 (Warn)
 * - 0 (Error)
 */

class Logger {
  constructor (logLevel = 2) {
    this.logLevel = logLevel
  }

  _timestamp (msg) {
    return new Date().toLocaleString().slice(0, 24)
  }

	set (level) {
		this.logLevel = level
  }

  debug (msg) {
    if (this.logLevel < 3) return
    console.info(`[${this._timestamp()}] DEBUG: ${msg}`)
  }

  isDebug (msg) {
    return this.logLevel >= 3
  }

  info (msg) {
    if (this.logLevel < 2) return
    console.info(`[${this._timestamp()}] INFO: ${msg}`)
  }

  warn (msg) {
    if (this.logLevel < 1) return
    console.info(`[${this._timestamp()}] WARN: ${msg}`)
  }

  error (msg) {
    if (this.logLevel < 0) return
    console.info(`[${this._timestamp()}] ERROR: ${msg}`)
  }
}

const instance = new Logger()

module.exports = instance
