var WebSocketServer = require('ws').Server,
	wss = new WebSocketServer({
		port: 3331
	})

wss.on('connection', (ws) => {
	ws.on('message', (message) => {
		ws.send(message)
	})

})
