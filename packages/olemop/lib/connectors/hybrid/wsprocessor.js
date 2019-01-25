var http = require('http')
var EventEmitter = require('events')
var util = require('util');
var WebSocket = require('ws');

var ST_STARTED = 1;
var ST_CLOSED = 2;

/**
 * websocket protocol processor
 */
var Processor = function () {
  EventEmitter.call(this);
  this.httpServer = http.createServer()

  this.wsServer = new WebSocket.Server({ server: this.httpServer })

  this.wsServer.on('connection', (socket) => {
    // emit socket to outside
    this.emit('connection', socket);
  });

  this.state = ST_STARTED;
};
util.inherits(Processor, EventEmitter);

module.exports = Processor;

Processor.prototype.add = function (socket, data) {
  if (this.state !== ST_STARTED) return
  this.httpServer.emit('connection', socket);
  if (typeof socket.ondata === 'function') {
    // compatible with stream2
    socket.ondata(data, 0, data.length);
  } else {
    // compatible with old stream
    socket.emit('data', data);
  }
};

Processor.prototype.close = function () {
  if (this.state !== ST_STARTED) return
  this.state = ST_CLOSED;
  this.wsServer.close();
  this.wsServer = null;
  this.httpServer = null;
};
