/**
 * agent monitor data map
 *
 * every agent put start and end time in to route map
 * then report to master
 */

const fs = require('fs')
const util = require('../common/util')

const monitor = module.exports

const dataMap = {}
let profData = {}
let incrMap = {}

monitor.getData = function () {
  return {
    timeData: profData,
    incrData: incrMap
  }
}

monitor.clear = function () {
	profData = {}
  incrMap = {}
}

monitor.incr = function (name) {
  incrMap[name] = ~~incrMap[name] + 1
  console.log(incrMap[name] + ' ' + name)
}

monitor.decr = function (name) {
  incrMap[name] = incrMap[name] === null ? 0 : incrMap[name] - 1
}

monitor.beginTime = function (route, uid, id) {
  const time = Date.now()
  if (!dataMap[route]) {
    dataMap[route] = {}
  }
  if (!dataMap[route][uid]) {
    dataMap[route][uid] = {}
    dataMap[route][uid][id] = time
  }
  dataMap[route][uid][id] = time
}

monitor.endTime = function (route, uid, id) {
	if (!dataMap[route] || !dataMap[route][uid] || !dataMap[route][uid][id]) return
  const beginTime = dataMap[route][uid][id]
	delete dataMap[route][uid][id]
  const span = Date.now() - beginTime
  // saveTimes(uid, route + ':' + span + '\r\n')
  const srcData = profData[route]
  if (!srcData) {
    profData[route] = { min: span, max: span, avg: span, num: 1 }
  } else {
    if (span < srcData.min) {
      srcData.min = span
    }
    if (span > srcData.max) {
      srcData.max = span
    }
    srcData.avg = (srcData.avg * srcData.num + span) / (srcData.num + 1)
    srcData.num = srcData.num + 1
  }
}

const saveTimes = function (uid, value) {
  fs.appendFile(util.getPath() + '/detail', value, function (err) {
    if (err) {
      console.log(err)
    }
  })
}
