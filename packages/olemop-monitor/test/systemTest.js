const systemMonitor = require('../lib/systemMonitor')

function test() {
	systemMonitor.getSysInfo((err, data) => {
		console.log('operating-system information is: %j', data)
	})
}

test()
