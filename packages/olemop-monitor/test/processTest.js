const processMonitor = require('../lib/processMonitor')

function test() {
	processMonitor.getPsInfo({
		pid: 3650,
		serverId: 'auth-server-1'
	}, (err, data) => {
		if (err) {
			console.log(err)
			return
    }
		console.log('process information is: %j', data)
	})
}

test()
