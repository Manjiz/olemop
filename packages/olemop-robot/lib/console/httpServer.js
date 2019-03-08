/**
 * ------------------------------------
 * HTTP Server
 * ------------------------------------
 *
 * This file defines HttpServer and the singleton httpServer.
 *
 * This file defines a generic HTTP server that serves static files and that can be configured
 * with new routes. It also starts the nodeload HTTP server unless require('nodeload/config').disableServer() was called.
 */

const fs = require('fs')
const path = require('path')
const http = require('http')
const EventEmitter = require('events')
const stat = require('../monitor/stat')

class HttpServer extends EventEmitter {
  constructor () {
    super()
    // port hostname connections server
    this.routes = []
    this.running = false
  }

  /**
   * Start the server listening on the given port
   */
  start (port = 8000, hostname = 'localhost') {
    if (this.running) return
    this.running = true

    this.port = port
    this.hostname = hostname
    this.connections = []

    this.server = http.createServer((req, res) => {
      this.route_(req, res)
    })

    this.server.on('connection', (c) => {
      // We need to track incoming connections, beause Server.close() won't terminate active
      // connections by default.
      c.on('close', () => {
        const idx = this.connections.indexOf(c)
        if (idx !== -1) {
          this.connections.splice(idx, 1)
        }
      })
      this.connections.push(c)
    })
    this.server.listen(port, hostname)

    this.emit('start', this.hostname, this.port)
    return this
  }

  /**
   * Terminate the server
   */
  stop () {
    if (!this.running) return
    this.running = false
    this.connections.forEach((c) => c.destroy())
    this.server.close()
    this.server = null
    this.emit('end')
  }

  /**
   * When an incoming request matches a given regex, route it to the provided handler:
   * function (url, ServerRequest, ServerResponse)
   */
  addRoute (regex, handler) {
    this.routes.unshift({ regex, handler })
    return this
  }

  removeRoute (regex, handler) {
    this.routes = this.routes.filter((r) => {
      return !(regex === r.regex && (!handler || handler === r.handler))
    })
    return this
  }

  route_ (req, res) {
    for (let i = 0; i < this.routes.length; i++) {
      const item = this.routes[i]
      if (req.url.match(item.regex)) {
        item.handler(req.url, req, res)
        return
      }
    }
    if (req.method === 'GET') {
      this._serveFile('.' + req.url, res)
    } else {
      res.writeHead(405, { 'Content-Length': '0' })
      res.end()
    }
  }

  _serveFile (file, res) {
		if (file.lastIndexOf('report') !== -1) {
	  	doReport(res)
	  	return
	  }
		if (file === './') {
      file = 'index.html'
    }
    file = path.join(__dirname, file)
    fs.stat(file, (err) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.write('Cannot find file: ' + file)
        res.end()
        return
      }

      fs.readFile(file, 'binary', (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.write(`Error opening file ${file}: ${err}`)
        } else {
          if (file.lastIndexOf('.html') === -1) {
            res.writeHead(200, { 'Content-Length': data.length })
            res.write(data, 'binary')
          } else {
            res.writeHead(200, {
              'Content-Length': data.length,
              'Content-Type': 'text/html; charset=utf-8'
            })
            res.write(data, 'binary')
          }
        }
        res.end()
      })
    })
  }
}

function doReport (res) {
  const pdata = stat.getData()
	const mdata = []
  let isShow = false
  Object.keys(pdata).forEach((pdataKey) => {
    const val = pdata[pdataKey]

    // { name, uid, summary, charts: { latency: { name, uid, columns, rows } } }
    const single = {}
    isShow = true
    single['name'] = pdataKey
    single['uid'] = pdataKey
    // length of longest row
    let maxRowLen = 0
    const keyColumns = Object.keys(val).filter((key) => {
      const len = val[key].length
      maxRowLen = Math.max(maxRowLen, len)
      return len > 0
    })
    const grows = []
    for (let i = 0; i < maxRowLen; i++) {
      grows.push([i + 1, ...keyColumns.map((key) => val[key][i] || 0)])
    }
    const gsummary = {}
    keyColumns.forEach((key) => {
      const kdata = val[key]
      let min = Number.MAX_VALUE
      let max = 0
      let sindex = 0
      let sum = 0
      kdata.forEach((time) => {
        if (time > max) max = time
        if (time < min) min = time
        sum += time
        ++sindex
      })
      const avg = Math.round(sum / sindex)
      // @todo where is `i`
      gsummary[key] = { max, min, avg, qs: Math.round(i * 1000 / avg) }
    })
    single['summary'] = gsummary
    single['charts'] = {
      latency: {
        name: 'robot',
        uid: single['uid'],
        columns: ['users', ...keyColumns],
        rows: grows
      }
    }
    if (grows.length > 0)	{
      mdata.push(single)
    }
  })
  if (isShow) {
  	res.write(JSON.stringify(mdata), 'binary')
  }
	res.end()
}

// =================
// Singletons
// =================

// The global HTTP server used by nodeload
const httpServer = new HttpServer()
httpServer.on('start', (hostname, port) => {
  console.log(`Started HTTP server on ${hostname}:${port}.`)
})
httpServer.on('end', () => {
  console.log('Shutdown HTTP server.')
})

module.exports = httpServer
