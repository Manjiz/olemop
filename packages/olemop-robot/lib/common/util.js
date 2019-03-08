/**
 * ------------------------------------
 * Statistics Manager
 * ------------------------------------
 */

const fs = require('fs')

module.exports = {
  getPath () {
    return __filename.substring(0, __filename.lastIndexOf('node_modules')) + 'log'
  },

  createPath () {
    const path = this.getPath()
    try {
      fs.accessSync(path)
    } catch (err) {
      fs.mkdirSync(path)
    }
  },

  deleteLog () {
    const path = this.getPath()
    try {
      fs.unlinkSync(path + '/detail')
      fs.unlinkSync(path + '/.log')
    } catch (err) {
    }
  }
}
