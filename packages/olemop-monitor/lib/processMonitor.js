const { exec } = require('child_process')
const util = require('../utils/util')

/**
 * get the process information by command 'ps auxw | grep serverId | grep pid'
 *
 * @param {Object} param
 * @param {Function} callback
 */
function getPsInfo(param, callback) {
	if (process.platform === 'win32') return
	const pid = param.pid
	const cmd = `ps auxw | grep ${pid} | grep -v 'grep'`
  // const cmd = `ps auxw | grep -E '.+?\\s+${pid}\\s+'`
  // output:
  //   userName     65919   0.0  0.1  5022004  22560 s000  S+    4:13下午   0:01.46 /*/bin/node /*/app.js env=development id=auth-server-1 host=127.0.0.1 port=3650 serverType=auth
	exec(cmd, (err, output) => {
		if (err) {
			if (err.code === 1) {
				console.log('the content is null!')
			} else {
				console.error(`getPsInfo failed! ${err.stack}`)
			}
			callback(err, null)
			return
		}
    format(param, output, callback)
	})
}

/**
 * convert serverInfo to required format, and the callback will handle the serverInfo
 *
 * @param {Object} param contains serverId etc
 * @param {String} data the output if the command 'ps'
 * @param {Function} cb
 */
function format(param, data, cb) {
	const time = util.formatTime(new Date())
	let outArray = data.toString().trim().split(/\s+/)
  let outValueArray = []
  outArray.forEach((item) => {
    if (!isNaN(item)) {
			outValueArray.push(item)
		}
  })
	const ps = {}
	ps.time = time
	ps.serverId = param.serverId
	ps.serverType = ps.serverId.split('-')[0]
	const pid = ps.pid = param.pid
	ps.cpuAvg = outValueArray[1]
	ps.memAvg = outValueArray[2]
	ps.vsz = outValueArray[3]
	ps.rss = outValueArray[4]
	outValueArray = []
	if (process.platform === 'darwin') {
		ps.usr = 0
		ps.sys = 0
		ps.gue = 0
		cb(null, ps)
		return
	}
	exec(`pidstat -p ${pid}`, (err, output) => {
		if (err) {
			console.error(`the command pidstat failed! ${err.stack}`)
			return
		}
    outArray = output.toString().trim().split(/\s+/)
    outArray.forEach((item) => {
      if (!isNaN(item)) {
        outValueArray.push(item)
      }
    })
		ps.usr = outValueArray[1]
		ps.sys = outValueArray[2]
		ps.gue = outValueArray[3]

		cb(null, ps)
	})
}

module.exports = {
  getPsInfo
}
