const os = require('os')
const { exec } = require('child_process')
const util = require('../utils/util')

const info = {}

/**
 * get information of operating-system
 *
 * @param {Function} callback
 */
function getSysInfo(callback) {
	if (process.platform === 'win32') return
  const reData = getBasicInfo()
  exec('iostat ', (err, output) => {
		if (err) {
			console.error(`getSysInfo failed! ${err.stack}`)
			callback(err, reData)
		} else {
			reData.iostat = format(output)
			callback(null, reData)
		}
  })
}

/**
 * analysis the disk i/o data,return a map contains kb_read,kb_wrtn ect.
 *
 * @param {string} data, the output of the command 'iostat'
 */
function format(data) {
	const time = util.formatTime(new Date())
  const outputArray = data.toString().replace(/^\s+|\s+$/g,'').split(/\s+/)
  const outputValues = []
  let counter = 0
  outputArray.forEach((item) => {
    if (!isNaN(item)) {
      outputValues[counter] = parseFloat(item)
      counter++
    }
  })
  if (outputValues.length === 0) return
  return {
    date: time,
    disk: {
      kb_read: outputValues[9],
      kb_wrtn: outputValues[10],
      kb_read_per: outputValues[7],
      kb_wrtn_per: outputValues[8],
      tps: outputValues[6]
    },
    cpu: {
      cpu_user: outputValues[0],
      cpu_nice: outputValues[1],
      cpu_system: outputValues[2],
      cpu_iowait: outputValues[3],
      cpu_steal: outputValues[4],
      cpu_idle: outputValues[5]
    }
  }
}

/**
 * get basic information of operating-system
 *
 * @return {Object} result
 */
function getBasicInfo() {
	const result = {}
  for (let key in info) {
    result[key] = info[key]()
  }
	return result
}

info.hostname = os.hostname

info.type = os.type

info.platform = os.platform

info.arch = os.arch

info.release = os.release

info.uptime = os.uptime

info.loadavg = os.loadavg

info.totalmem = os.totalmem

info.freemem = os.freemem

info.cpus = os.cpus

info.networkInterfaces = os.networkInterfaces

info.versions = () => process.versions

info.arch = () => process.arch

info.platform = () => process.platform

info.memoryUsage = process.memoryUsage

info.uptime = process.uptime

module.exports = {
  getSysInfo
}
