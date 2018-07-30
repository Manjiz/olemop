  var Emitter = require('emitter');
  window.EventEmitter = Emitter;

  var protocol = require('@olemop/protocol');
  window.Protocol = protocol;

  var protobuf = require('@olemop/protobuf');
  window.protobuf = protobuf;

  var pomelo = require('pomelo-jsclient-websocket');
  window.pomelo = pomelo;
