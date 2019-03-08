class Node {
  constructor (nodeId, iport) {
    // this.dom
    this.nodeId = nodeId
    this.iport = iport
  }

  render () {
    // Add to control panel in alphabetical order
    $('#conndiv').append(`<label id="node_${this.nodeId}" data-label="${this.nodeId}"><span class="node">[${this.iport}];</label>`)
  }

  destroy () {
    this.dom.remove()
  }
}

function doReportDetail (msg) {
	updateDetailAgent(msg.detailAgentSummary,' Summary')
	updateAvgAgent(msg.detailAgentAvg, ' Response Time')
	updateEveryAgent(msg.detailAgentQs, 'qs_div', ' Qps Time')
}

function doReport (message) {
	updateMain(message.globaldata)
}

function showUI (value) {
	// $('#btn-run').css('display', value)
	// $('#runcode-button').css('display', value)
	// $('#codeinput').css('display', value)
}

class WebClient {
  constructor () {
    this.nodes = {}
    this.ids = {}
    this.streams = {}
    this.count = 0
    this.detailTimer = false
    this.histories = {}
    this.stats = { messages: 0, nodes: 0, start: new Date() }
    this.connected = false
    this.socket = io.connect(`http://${window.location.hostname}:8888`)
    this.socket.on('connect', () => {
      this.connected = true
      this.socket.emit('announce_web_client')
      const REPORT_INTERVAL = 3 * 1000

      setInterval(() => {
        this.socket.emit('pull_webreport', {})
      }, REPORT_INTERVAL)

      setInterval(() => {
        if (this.detailTimer) {
          this.socket.emit('pull_detailreport', {})
        }
      }, REPORT_INTERVAL)
    })

    // Add a new Node to pool
    this.socket.on('add_node', ({ nodeId, iport }) => {
      console.log(JSON.stringify({ nodeId, iport }))
      if (!this.ids[nodeId]) {
        this.addNode(nodeId, iport)
        this.ids[nodeId] = nodeId
        showUI('block')
      } else {
        console.log(`duplicated server add ${nodeId}`)
      }
    })

    // Remove Node from pool
    this.socket.on('remove_node', ({ node }) => {
      this.removeNode(node)
    })

    // report status
    this.socket.on('push_webreport', (snum, suser, stimeData, sincrData) => {
      // doReport(timeData)
      $('#agentinput').val(snum)
      $('#maxuserinput').val(suser)
      updateIncrData(sincrData)
      updateTimesData(snum, suser, stimeData)
    })

    this.socket.on('push_detailreport', (message) => {
      doReportDetail(message)
    })

    /* temporary code */
    this.socket.on('error', (message) => {
      $('#errorinput').html(`[${message.node}]:${message.error}`).end()
    })
    /* temporary code */

    this.socket.on('statusreport', (message) => {
      const status = message.status
      let hit = ''
      if (status === 0) {
        hit = 'IDLE'
      }
      if (status === 1) {
        hit = 'READY'
        $('#btn-run').css('display', '')
      }
      if (status === 2) {
        hit = 'RUNNING'
        $('#btn-run').css('display', 'none')
      }
      $('#hitdiv').html(hit)
    })

    // Update total message count stats
    // this.socket.on('stats', (message) => {
    //   if (!this.stats.message_offset) {
    //     this.stats.message_offset = message.message_count
    //   }
    //   this.stats.messages = message.message_count - this.stats.message_offset
    // })
  }

  addNode (nodeId, iport) {
    const node = new Node(nodeId, iport, this)
    node.render()
    this.nodes[nodeId] = node
    this.stats.nodes++
    if (this.stats.nodes >= parseInt($('#agentinput').val())) {
    	$('#btn-ready').val('ReReady')
    	$('#btn-run').show()
    } else {
    	$('#btn-ready').val('Readying')
    	$('#btn-run').css('display', 'none')
    }
  }

  removeNode (nodeId) {
    const node = this.nodes[nodeId]
    if (node) {
    	node.destroy()
    	delete this.nodes[node.nodeId]
    }
    this.stats.nodes--
    if (this.stats.nodes <= 0) {
    	showUI('none')
    	this.stats.nodes = 0
    }
    delete this.ids[nodeId]
  }

  // Resize screens
  resize (scount, resizeBottom) {
    if (!resizeBottom) {
      resizeBottom = true
    }
    // $('#controls2, #right').height($(window).height())
    // $('.console').height(calcScreenSize(scount))
    const screenWidth = $(window).width() - $('#controls2').width()
    $('#right' + (resizeBottom ? ', #bottom' : '')).width(screenWidth).css('max-width', screenWidth)
  }
}
