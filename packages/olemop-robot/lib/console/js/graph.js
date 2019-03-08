const graphs = {}

function updateGraph (chart, targetName) {
  let main = document.getElementById(targetName)

	if (!main) {
		const tname = targetName + 'div'
    const _dom = $('#avg_template')
      .clone()
      .attr('id', tname)
      .find('.screen-label')
      .html(targetName + ' Response Time Graph')
      .end()
      .find('.cgraphdiv')
      .attr('id', targetName)
      .end()
		$('#graph_div').append(_dom)
		main = document.getElementById(targetName)
		const p = $('#' + tname)
		p.find('.screen-buttons').click(() => {
			p.find('.console').toggle()
			// p.find('.console').hide()
			// p.css('height', '26px')
		})
  }

	if (graphs[chart.uid]) {
		graphs[chart.uid].updateOptions({
			file: chart.rows,
			labels : chart.columns
		})
	} else {
		const newchart = document.createElement('div')
		newchart.setAttribute('class', 'post')
    newchart.innerHTML = `
    <div style="width: 100%; float: left;">
      <div id="chart${chart.uid}" style="float: left; width: 92%; height: 200px;"></div>
      <div id="chartlegend${chart.uid}" style="float: left; width: 80px; height: 200px;"></div>
    </div>
    `
    main.appendChild(newchart)
    // console.log('chart.rows', chart.rows)
		graphs[chart.uid] = new Dygraph(document.getElementById(`chart${chart.uid}`), chart.rows, {
			labelsDiv: document.getElementById(`chartlegend${chart.uid}`),
			labelsSeparateLines: true,
			labels: chart.columns
		})
	}
}

function updateDetailAgent (_totalAgentSum, title) {
	for (let agent in _totalAgentSum) {
		const target = $('#sum_' + agent)
		if (target.html()) {
      target.remove()
    }
		const _summary = _totalAgentSum[agent]
		const _dom = $('#table_template').clone()
		.find('.summary').html(jsonToTable(_summary)).end().attr('id', 'sum_' + agent)
		_dom.find('.screen-label').html(agent + title)
    $('#summary_div').append(_dom)
  }
  $('.close').click(function () {
  	$(this).parent().parent().parent().parent().css('display', 'none')
  })
}

function showDetailAgent () {
	let sumshow = ''
	$('#summary_div').css('display', sumshow)
	$('#table_img').css('display', sumshow)
	$('#table_img').click(function () {
		sumshow = 'none'
		$(this).css('display', sumshow)
		$('#summary_div').css('display', sumshow)
	})
}


function updateAvgAgent (everyAgentavgDatas, title) {
	for (let index in everyAgentavgDatas) {
		const chart = everyAgentavgDatas[index]
		const uid = chart.uid
		const target = $('#avg_' + uid)
		if (!target.html()) {
			const _dom = $('#avg_template').clone().attr('id', 'avg_' + uid)
			_dom.find('.screen-label').html(uid.substring(3, uid.length) + title)
			_dom.find('.avgrestime').attr('id', 'davg_' + uid)
			_dom.css('display', 'block')
			$('#avg_div').append(_dom)
    }
    updateGraph(chart, 'davg_' + uid)
  }
}

function showDetailAgentAvg () {
	let avgshow = ''
	$('#avg_div').css('display', avgshow)
	$('#avg_img').css('display', avgshow)
	$('#avg_img').click(function () {
		avgshow = 'none'
		$(this).css('display', avgshow)
		$('#avg_div').css('display', avgshow)
	})
}

function showDetailAgentQs () {
	let qsshow = ''
	$('#qs_div').css('display', qsshow)
	$('#qs_img').css('display', qsshow)
	$('#qs_img').click(function () {
		qsshow = 'none'
		$(this).css('display', qsshow)
		$('#qs_div').css('display', qsshow)
	})
}

function updateEveryAgent (everyAgentavgDatas, divname, title) {
	for (let index in everyAgentavgDatas) {
		const chart = everyAgentavgDatas[index]
		const uid = chart.uid
		const target = $('#qs_' + uid)
		if (!target.html()) {
			const _dom = $('#avg_template').clone().attr('id', 'qs_' + uid)
			_dom.find('.screen-label').html(uid.substring(2, uid.length) + title)
			_dom.find('.avgrestime').attr('id', 'dqs_' + uid)
			$('#qs_div').append(_dom)
    }
    updateGraph(chart, 'dqs_' + uid)
  }
  $('.close').click(function () {
  	$(this).parent().parent().parent().parent().css('display', 'none')
 })
}


// function updateEveryAgent1 (everyAgentqsDatas, divname, title) {
// 	for (let index in everyAgentqsDatas) {
// 		const chart = everyAgentqsDatas[index]
// 		const uid = chart.uid
// 		const target = $('#' + uid)
// 		if (!target.html()) {
// 			const _dom = $('#avg_template').clone()
// 			_dom.find('.screen-label').html(`${uid} ${title}`)
// 			_dom.find('.avgrestime').attr('id', uid)
// 			_dom.css('display', 'block')
// 			$('#' + divname).append(_dom)
// 		}
//     updateGraph(chart, uid)
//   }
//   $('.close').click(function () {
//   	$(this).parent().parent().parent().parent().css('display', 'none')
//  })
// }

// update([{
//   name: '',
//   uid: 0,
//   summary: {
//     'Load Data uniques uniqs': 2000
//   },
//   charts: {
//     latency: {
//       name: '',
//       uid: 22,
//       columns: ['time', 'min', 'max', 'avg', 'median', '95%', '99%'],
//       rows: [
//         [0.03, 0, 0, 0, 0, 0, 0],
//         [0.03, 5, 92, 27.5, 26, 45, 75],
//         [0.04, 6, 62, 26, 25, 45, 57]
//       ]
//     }
//   }
// }])
