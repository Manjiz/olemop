var fs = require('fs')
var consoleService = require('./lib/consoleService')

module.exports.createMasterConsole = consoleService.createMasterConsole
module.exports.createMonitorConsole = consoleService.createMonitorConsole
module.exports.adminClient = require('./lib/client/client')

const modules = {}
fs.readdirSync(__dirname + '/lib/modules').forEach(function (filename) {
	if (/\.js$/.test(filename)) {
		var name = filename.substr(0, filename.lastIndexOf('.'))
		var _module = require('./lib/modules/' + name)
		if (!_module.moduleError) {
      Object.defineProperty(modules, name, {
        get () {
          return _module
        }
      })
		}
	}
})

exports.modules = modules
