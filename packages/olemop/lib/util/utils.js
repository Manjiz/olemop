const os = require('os')
const util = require('util')
const { exec } = require('child_process')
const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const Constants = require('./constants')
const olemop = require('../olemop')

const utils = module.exports

/**
 * Check a string whether ends with another string
 */
utils.endsWith = (str, suffix) => {
  if (typeof str !== 'string' || typeof suffix !== 'string' ||
    suffix.length > str.length) {
    return false
  }
  return str.indexOf(suffix, str.length - suffix.length) !== -1
}

/**
 * Check a string whether starts with another string
 */
utils.startsWith = (str, prefix) => {
  if (typeof str !== 'string' || typeof prefix !== 'string' || prefix.length > str.length) {
    return false
  }
  return str.indexOf(prefix) === 0
}

/**
 * Compare the two arrays and return the difference.
 */
utils.arrayDiff = (array1, array2) => {
  const o = array2.reduce((prev, item) => {
    prev[item] = true
    return prev
  }, {})
  return array1.filter((item) => {
    return !o[item]
  })
}

/*
 * Date format
 */
utils.format = (date, format = 'MMddhhmm') => {
  const o = {
    'M+': date.getMonth() + 1,
    'd+': date.getDate(),
    'h+': date.getHours(),
    'm+': date.getMinutes(),
    's+': date.getSeconds(),
    // quarter
    'q+': Math.floor((date.getMonth() + 3) / 3),
    'S': date.getMilliseconds()
  }

  if (/(y+)/.test(format)) {
    format = format.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length))
  }

  for (let k in o) {
    if (new RegExp(`(${k})`).test(format)) {
      format = format.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length))
    }
  }
  return format
}

/**
 * check if has Chinese characters.
 */
utils.hasChineseChar = (str) => /.*[\u4e00-\u9fa5]+.*$/.test(str)

/**
 * transform unicode to utf8
 */
utils.unicodeToUtf8 = (str) => {
  let utf8Str = ''
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    if (ch >= 0x0 && ch <= 0x7F) {
      utf8Str += str.charAt(i)
    } else if (ch >= 0x80 && ch <= 0x7FF) {
      utf8Str += String.fromCharCode(0xc0 | ch >> 6 & 0x1F)
      utf8Str += String.fromCharCode(0x80 | ch & 0x3F)
    } else if (ch >= 0x800 && ch <= 0xFFFF) {
      utf8Str += String.fromCharCode(0xe0 | ch >> 12 & 0xF)
      utf8Str += String.fromCharCode(0x80 | ch >> 6 & 0x3F)
      utf8Str += String.fromCharCode(0x80 | ch & 0x3F)
    } else if (ch >= 0x10000 && ch <= 0x1FFFFF) {
      utf8Str += String.fromCharCode(0xF0 | ch >> 18 & 0x7)
      utf8Str += String.fromCharCode(0x80 | ch >> 12 & 0x3F)
      utf8Str += String.fromCharCode(0x80 | ch >> 6 & 0x3F)
      utf8Str += String.fromCharCode(0x80 | ch & 0x3F)
    } else if (ch >= 0x200000 && ch <= 0x3FFFFFF) {
      utf8Str += String.fromCharCode(0xF8 | ch >> 24 & 0x3)
      utf8Str += String.fromCharCode(0x80 | ch >> 18 & 0x3F)
      utf8Str += String.fromCharCode(0x80 | ch >> 12 & 0x3F)
      utf8Str += String.fromCharCode(0x80 | ch >> 6 & 0x3F)
      utf8Str += String.fromCharCode(0x80 | ch & 0x3F)
    } else if (ch >= 0x4000000 && ch <= 0x7FFFFFFF) {
      utf8Str += String.fromCharCode(0xFC | ch >> 30 & 0x1)
      utf8Str += String.fromCharCode(0x80 | ch >> 24 & 0x3F)
      utf8Str += String.fromCharCode(0x80 | ch >> 18 & 0x3F)
      utf8Str += String.fromCharCode(0x80 | ch >> 12 & 0x3F)
      utf8Str += String.fromCharCode(0x80 | ch >> 6 & 0x3F)
      utf8Str += String.fromCharCode(0x80 | ch & 0x3F)
    }
  }
  return utf8Str
}

/**
 * Ping server to check if network is available
 */
utils.ping = (host, cb) => {
  if (!module.exports.isLocal(host)) {
    const cmd = `ping -w 15 ${host}`
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        cb(false)
        return
      }
      cb(true)
    })
  } else {
    cb(true)
  }
}

/**
 * Check if server is exsit.
 */
utils.checkPort = function (server, cb) {
  if (!server.port && !server.clientPort) {
    olemopUtils.invokeCallback(cb, 'leisure')
    return
  }
  const port = server.port || server.clientPort
  const host = server.host
  const generateCommand = (host, port) => {
    let ssh_params = olemop.app.get(Constants.RESERVED.SSH_CONFIG_PARAMS)
    ssh_params = ssh_params && Array.isArray(ssh_params) ? ssh_params.join(' ') : ''
    const cmd = !this.isLocal(host)
      ? util.format(`ssh ${host} ${ssh_params} "netstat -an|awk \'{print $4}\'|grep ${port}|wc -l"`)
      : util.format(`netstat -an|awk \'{print $4}\'|grep ${port}|wc -l`)
    return cmd
  }
  const cmd1 = generateCommand(host, port)
  const child = exec(cmd1, (err, stdout, stderr) => {
    if (err) {
      logger.error('command %s execute with error: %j', cmd1, err.stack)
      olemopUtils.invokeCallback(cb, 'error')
    } else if (stdout.trim() !== '0') {
      olemopUtils.invokeCallback(cb, 'busy')
    } else {
      const cmd2 = generateCommand(host, server.clientPort)
      exec(cmd2, (err, stdout, stderr) => {
        if (err) {
          logger.error('command %s execute with error: %j', cmd2, err.stack)
          olemopUtils.invokeCallback(cb, 'error')
        } else if (stdout.trim() !== '0') {
          olemopUtils.invokeCallback(cb, 'busy')
        } else {
          olemopUtils.invokeCallback(cb, 'leisure')
        }
      })
    }
  })
}

utils.isLocal = (host) => {
  const hostList = ['127.0.0.1', 'localhost', '0.0.0.0']
  olemop.app && (hostList.push(olemop.app.master.host))
  return hostList.includes(host) || _inLocal(host)
}

/**
 * Load cluster server.
 */
utils.loadCluster = (app, server, serverMap) => {
  const increaseFields = {}
  const host = server.host
  const count = parseInt(server[Constants.RESERVED.CLUSTER_COUNT])
  let seq = app.clusterSeq[server.serverType]
  if (!seq) {
    seq = 0
    app.clusterSeq[server.serverType] = count
  } else {
    app.clusterSeq[server.serverType] = seq + count
  }

  for (let key in server) {
    const value = server[key].toString()
    if (value.indexOf(Constants.RESERVED.CLUSTER_SIGNAL) > 0) {
      const base = server[key].slice(0, -2)
      increaseFields[key] = base
    }
  }

  const __clone = (src) => {
    return Object.keys(src).reduce((prev, key) => {
      prev[key] = src[key]
      return prev
    }, {})
  }

  for (let i = 0, l = seq; i < count; i++, l++) {
    const cserver = __clone(server)
    cserver.id = `${Constants.RESERVED.CLUSTER_PREFIX}${server.serverType}-${l}`
    for (let k in increaseFields) {
      const v = parseInt(increaseFields[k])
      cserver[k] = v + i
    }
    serverMap[cserver.id] = cserver
  }
}

utils.extends = function (origin, add) {
  if (!add || !this.isObject(add)) {
    return origin
  }

  const keys = Object.keys(add)
  let i = keys.length
  while (i--) {
    origin[keys[i]] = add[keys[i]]
  }
  return origin
}

utils.headHandler = (headBuffer) => {
  let len = 0
  for (let i = 1; i < 4; i++) {
    if (i > 1) {
      len <<= 8
    }
    len += headBuffer.readUInt8(i)
  }
  return len
}

const _inLocal = (host) => {
  for (let index in localIps) {
    if (host === localIps[index]) {
      return true
    }
  }
  return false
}

const localIps = (() => {
  const ifaces = os.networkInterfaces()
  const ips = []
  const __func = (details) => {
    if (details.family === 'IPv4') {
      ips.push(details.address)
    }
  }
  Object.values(ifaces).forEach((nisOfDevice) => {
    nisOfDevice.forEach(__func)
  })
  return ips
})()

utils.isObject = (arg) => typeof arg === 'object' && arg !== null
