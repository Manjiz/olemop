const fs = require('fs')
const util = require('util')
const log4js = require('log4js')

const funcs = {
	env: (name) => process.env[name],
	args: (name) => process.argv[name],
	opts: (name, opts) => opts && opts[name]
}

/**
 * [2010-01-17 11:43:37.987] [DEBUG] [default] - Some debug messages
 * [2010-01-17 11:43:37.987] [DEBUG] [default] - [xxx] [yyy] Some debug messages
 * [2010-01-17 11:43:37.987] [DEBUG] [default] - 32: [xxx] [yyy] Some debug messages
 */
const getLogger = (...args) => {
  let categoryName = args[0]

  const prefix = args.slice(1).map((item) => `[${item}]`).join(' ') + ' '

	if (typeof categoryName === 'string') {
		// category name is __filename then cut the prefix path
		categoryName = categoryName.replace(process.cwd(), '')
  }

  const logger = log4js.getLogger(categoryName)

  const pLogger = {}
	for (let key in logger) {
		pLogger[key] = logger[key]
	}

	['log', 'debug', 'info', 'warn', 'error', 'trace', 'fatal'].forEach((item) => {
		pLogger[item] = (...levelArgs) => {
			let p = ''
			if (!process.env.RAW_MESSAGE) {
				if (args.length > 1) {
					p = prefix
				}
				if (args.length && process.env.LOGGER_LINE) {
					p = `${getLine()}: ${p}`
				}
				p = colorize(p, colours[item])
			}

			if (args.length) {
				levelArgs[0] = p + levelArgs[0]
      }
			logger[item].apply(logger, levelArgs)
		}
	})
	return pLogger
}

const configState = {}

const initReloadConfiguration = (filename, reloadSecs) => {
	if (configState.timerId) {
		clearInterval(configState.timerId)
		delete configState.timerId
	}
	configState.filename = filename
	configState.lastMTime = getMTime(filename)
	configState.timerId = setInterval(reloadConfiguration, reloadSecs * 1000)
}

const getMTime = (filename) => {
	try {
		return fs.statSync(filename).mtime
	} catch (e) {
		throw new Error(`Cannot find file with given path: ${filename}`)
	}
}

const loadConfigurationFile = (filename) => {
  if (!filename) return
  return JSON.parse(fs.readFileSync(filename, 'utf8'))
}

const reloadConfiguration = () => {
	const mtime = getMTime(configState.filename)
	if (!mtime) return
	if (configState.lastMTime && (mtime.getTime() > configState.lastMTime.getTime())) {
		configureOnceOff(loadConfigurationFile(configState.filename))
	}
	configState.lastMTime = mtime
}

const configureOnceOff = (config) => {
  if (!config) return
  try {
    configureLevels(config.levels)
    if (config.replaceConsole) {
      log4js.replaceConsole()
    } else {
      log4js.restoreConsole()
    }
  } catch (err) {
    throw new Error(`Problem reading log4js config ${util.inspect(config)}. Error was "${err.message}" (${err.stack})`)
  }
}

const configureLevels = (levels) => {
  if (!levels) return
  for (let category in levels) {
    if (levels.hasOwnProperty(category)) {
      log4js.getLogger(category).setLevel(levels[category])
    }
  }
}

/**
 * Configure the logger.
 * Configure file just like log4js.json. And support ${scope:arg-name} format property setting.
 * It can replace the placeholder in runtime.
 * scope can be:
 *     env: environment variables, such as: env:PATH
 *     args: command line arguments, such as: args:1
 *     opts: key/value from opts argument of configure function
 *
 * @param {string|Object} config configure filename or configure object
 * @param {Object} opts options
 */
const configure = (config, opts = {}) => {
	const filename = config
	config = config || process.env.LOG4JS_CONFIG

	if (typeof config === 'string') {
		config = JSON.parse(fs.readFileSync(config, 'utf8'))
	}

	if (config) {
		config = replaceProperties(config, opts)
	}

	if (config && config.lineDebug) {
		process.env.LOGGER_LINE = true
	}

	if (config && config.rawMessage) {
		process.env.RAW_MESSAGE = true
	}

	if (filename && config && config.reloadSecs) {
		initReloadConfiguration(filename, config.reloadSecs)
	}

	// config object could not turn on the auto reload configure file in log4js
	return log4js.configure(config, opts)
}

const replaceProperties = (configObj, opts) => {
	if (configObj instanceof Array) {
    configObj.forEach((item, index) => {
      configObj[index] = replaceProperties(item, opts)
    })
	} else if (typeof configObj === 'object') {
		let field
		for (let f in configObj) {
			if (!configObj.hasOwnProperty(f)) continue
			field = configObj[f]
			if (typeof field === 'string') {
				configObj[f] = doReplace(field, opts)
			} else if (typeof field === 'object') {
				configObj[f] = replaceProperties(field, opts)
			}
		}
	}
	return configObj
}

/**
 * 替换配置值中的特定标识：${scope:name:defaultValue}
 * scope: env | args | opts
 */
const doReplace = (src, opts) => {
	if (!src) {
		return src
	}

	const ptn = /\$\{(.*?)\}/g
  let m
  let defaultValue
  let res = ''
  let lastIndex = 0

	while (m = ptn.exec(src)) {
		const pro = m[1]
		const ts = pro.split(':')
		if (ts.length !== 2 && ts.length !== 3) {
			res += pro
			continue
		}

		const scope = ts[0]
		const name = ts[1]
		if (ts.length === 3) {
			defaultValue = ts[2]
		}

		const func = funcs[scope]
		if (!func || typeof func !== 'function') {
			res += pro
			continue
		}

		res += src.substring(lastIndex, m.index)
		lastIndex = ptn.lastIndex
		res += func(name, opts) || defaultValue
	}

	if (lastIndex < src.length) {
		res += src.substring(lastIndex)
	}

	return res
}

const getLine = () => {
	const err = new Error()
	// now magic will happen: get line number from callstack
	if (process.platform === 'win32') {
		return err.stack.split('\n')[3].split(':')[2]
	} else {
    return err.stack.split('\n')[3].split(':')[1]
  }
}

const colorizeStart = (style) => style ? `\x1B[${styles[style][0]}m` : ''

const colorizeEnd = (style) => style ? `\x1B[${styles[style][1]}m` : ''

/**
 * Taken from masylum's fork (https://github.com/masylum/log4js-node)
 */
const colorize = (str, style) => colorizeStart(style) + str + colorizeEnd(style)

const styles = {
	// styles
	bold: [1, 22],
	italic: [3, 23],
	underline: [4, 24],
	inverse: [7, 27],
	// grayscale
	white: [37, 39],
	grey: [90, 39],
	black: [90, 39],
	// colors
	blue: [34, 39],
	cyan: [36, 39],
	green: [32, 39],
	magenta: [35, 39],
	red: [31, 39],
	yellow: [33, 39]
}

const colours = {
	all: 'grey',
	trace: 'blue',
	debug: 'cyan',
	info: 'green',
	warn: 'yellow',
	error: 'red',
	fatal: 'magenta',
	off: 'grey'
}

module.exports = {
	getLogger,
	getDefaultLogger: log4js.getDefaultLogger,

	addAppender: log4js.addAppender,
	loadAppender: log4js.loadAppender,
	clearAppenders: log4js.clearAppenders,
	configure: configure,

	replaceConsole: log4js.replaceConsole,
	restoreConsole: log4js.restoreConsole,

	levels: log4js.levels,
	setGlobalLogLevel: log4js.setGlobalLogLevel,

	layouts: log4js.layouts,
	appenders: log4js.appenders
}
