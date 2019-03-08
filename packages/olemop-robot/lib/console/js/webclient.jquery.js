/*
 * Instantiates WebClient(), binds document.ready()
 */

const webClient = new WebClient()

const REPORT_INTERVAL = 1000

// Update statistics widget
setInterval(() => {
  const elapsed = (Date.now() - webClient.stats.start.getTime()) / 1000
  const minutes = parseInt(elapsed / 60)
  const seconds = parseInt(elapsed % 60)
  // const rate = webClient.stats.messages / elapsed
  $('#stats')
    .find('.nodes b').html(webClient.stats.nodes).end()
    .find('.elapsed b').html(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`).end()
    //.find('.summary b').html(rate.toFixed(2))
}, REPORT_INTERVAL)

function jsonToTable (json) {
  let txt = ''
  for (let i in json) {
    const ele = json[i]
    txt += `<tr><td class=label>${ele.key}</td><td>${ele.max}</td><td>${ele.min}</td><td>${Math.round(ele.avg)}</td><td>${Math.round(ele.qps)}</td><td>${ele.num}</td></tr>`
  }
  return txt
}

const updateIncrData = function (sincrData) {
  const incrData = {}
  for (let agent in sincrData) {
    const params = sincrData[agent]
    for (let key in params) {
      incrData[key] = incrData[key] === null ? params[key] : incrData[key] + params[key]
    }
  }
  let incrHTML = ''
  for (let key in incrData) {
    incrHTML += `${key}:(${incrData[key]}) `
  }
  $('#errorinput').html(incrHTML)
}

let gdata = {}

const updateTimesData = function (agent, user, stimeData) {
  const conns = agent
  const act = {}
  const summary = {}
  for (let agent in stimeData) {
    for (let key in stimeData[agent]) {
      act[key] = {}
      summary[key] = null
    }
  }
  for (let key in act) {
    for (let agent in stimeData) {
      const single = stimeData[agent][key]
      if (!single) continue
      const exist = summary[key]
      if (!exist) {
        summary[key] = { key, min: single.min, max: single.max, avg: single.avg, num: single.num }
        summary[key].qps = 1000 / single.avg * conns
      } else {
        if (single.min < exist.min) {
          exist.min = single.min
        }
        if (single.max > exist.max) {
          exist.max = single.max
        }
        const num = exist.num + single.num
        exist.avg = (exist.avg * exist.num + single.avg * single.num) / num
        exist.qps = 1000 / exist.avg * conns
        exist.num = num
      }
    }
  }
  const sortSum = _.sortBy(summary, (ele) => -1 * ele.num)
  for (let index in sortSum) {
    const ex = sortSum[index]
    const key = ex.key
    const columns = [key, 'avg', 'min', 'max', 'qps']
    const grow = gdata[key] || []
    const last = grow[grow.length - 1]
    if (!last || last[0] !== ex.num) {
      grow.push([ex.num, ex.avg, ex.min, ex.max, ex.qps])
    }
    gdata[key] = grow
    const qpschart = {}
    qpschart.columns = columns
    qpschart.rows = grow
    qpschart.uid = key
    updateGraph(qpschart, key)
  }
  document.getElementById('reportSummary').innerHTML = jsonToTable(sortSum)
}

// Event bindings, main method
$(document).ready(function () {
  const bottomHeight = $('.stat:first').height()
  const barHeight = $('.bar:first').height()

  // Calculate individual screen size
  function calcScreenSize (scount) {
    if (!scount) {
      scount = $('#screens .screen').length
    }
    return (($(window).height() - bottomHeight - 20) / scount) - (barHeight + 53)
  }

  $(window).resize(() => {
    webClient.resize()
  })

	$('#runcode-button').css('display', 'none')
	$('#codeinput').css('display', 'none')

  webClient.resize()

  $('#btn-ready').click(function () {
    webClient.stats = { messages: 0, nodes: 0, start: new Date() }
    webClient.socket.emit('exit4reready')
    const agent = $('#agentinput').val()
    const user = $('#maxuserinput').val()
    webClient.socket.emit('ready', { agent, maxuser: user })
    $(this).attr('disable', true)
    $('#conndiv').html('')
    $('#btn-run').css('display', 'none')
  })

  $('#btn-run').click(function () {
		const agent = $('#agentinput').val()
		const maxuser = $('#maxuserinput').val()
    const script = $('#robotinput').val()
		webClient.socket.emit('run', { agent, maxuser, script })
    gdata = {}
    $('#avg_div').html('')
		$('#hitdiv').html('Running...')
  	$('#btn-run').css('display', 'none')
    $('#errorinput').html('')
  })

  $('#sumbtn').click(function () {
		webClient.detailTimer = true
  	showDetailAgent()
  })

  $('#avgbtn').click(function () {
		webClient.detailTimer = true
  	showDetailAgentAvg()
  })

  $('#qsbtn').click(function () {
		webClient.detailTimer = true
  	showDetailAgentQs()
  })
})
