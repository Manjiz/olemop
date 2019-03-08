/**
 * stat receive agent client monitor data
 * merger vaild data that has response
 * when server restart, it will clear
 */

const stat = module.exports

let _timeDataMap = {}
let _countDataMap = {}

stat.getTimeData = function () {
	return _timeDataMap
}

stat.getCountData = function () {
	return _countDataMap
}

/**
 * clear data
 */
stat.clear = function (agent) {
  if (agent) {
    delete _timeDataMap[agent]
    delete _countDataMap[agent]
  } else {
    _timeDataMap = {}
    _countDataMap = {}
  }
}

stat.merge = function (agent, { timeData, incrData }) {
 	_timeDataMap[agent] = timeData
	_countDataMap[agent] = incrData
}

// @todo stat.getDetails
// stat.getDetails = function () {
//   return {
//     detailAgentSummary,
//     detailAgentAvg,
//     detailAgentQs
//   }
// }

// @todo stat.getData
