const EventEmitter = require('wolfy87-eventemitter')
const Protocol = require('@olemop/protocol')
const protobuf = require('@olemop/protobuf/lib/client/protobuf')
// const rsa = require('./pomelo-rsasign/rsa')
// const decodeIO_protobuf = require('./lib/pomelo-decodeIO-protobuf/ProtoBuf')
let rsa
let decodeIO_protobuf

var JS_WS_CLIENT_TYPE = 'js-websocket'
var JS_WS_CLIENT_VERSION = '0.0.1'

var decodeIO_encoder = null
var decodeIO_decoder = null
var Package = Protocol.Package
var Message = Protocol.Message

if (typeof(window) != "undefined" && typeof(sys) != 'undefined' && sys.localStorage) {
  window.localStorage = sys.localStorage
}

var RES_OK = 200
var RES_FAIL = 500
var RES_OLD_CLIENT = 501

if (typeof Object.create !== 'function') {
  Object.create = function (o) {
    function F() {}
    F.prototype = o
    return new F()
  }
}

var root = window
// object extend from object
var olemop = Object.create(EventEmitter.prototype)
root.olemop = olemop
var socket = null
var reqId = 0
var callbacks = {}
var handlers = {}
// Map from request id to route
var routeMap = {}
// route string to code
var dict = {}
// code to route string
var abbrs = {}
var serverProtos = {}
var clientProtos = {}
var protoVersion = 0

var heartbeatInterval = 0
var heartbeatTimeout = 0
var nextHeartbeatTimeout = 0
// heartbeat gap threashold
var gapThreshold = 100
var heartbeatId = null
var heartbeatTimeoutId = null
var handshakeCallback = null

var decode = null
var encode = null

var useCrypto

var preventReconnect = false
var reconnect = false
var reconncetTimer = null
var reconnectUrl = null
var reconnectAttempts = 0
var reconnectionDelay = 5000
var DEFAULT_MAX_RECONNECT_ATTEMPTS = 10

var handshakeBuffer = {
  'sys': {
    type: JS_WS_CLIENT_TYPE,
    version: JS_WS_CLIENT_VERSION,
    rsa: {}
  },
  'user': {
  }
}

var initCallback = null

olemop.init = function (params, cb) {
  initCallback = cb
  var host = params.host
  var port = params.port

  encode = params.encode || defaultEncode
  decode = params.decode || defaultDecode

  var url = 'ws://' + host
  if (port) {
    url +=  ':' + port
  }

  handshakeBuffer.user = params.user
  if (params.encrypt) {
    useCrypto = true
    rsa.generate(1024, "10001")
    var data = {
      rsa_n: rsa.n.toString(16),
      rsa_e: rsa.e
    }
    handshakeBuffer.sys.rsa = data
  }
  handshakeCallback = params.handshakeCallback
  connect(params, url, cb)
}

var defaultDecode = olemop.decode = function (data) {
  // probuff decode
  var msg = Message.decode(data)

  if (msg.id > 0){
    msg.route = routeMap[msg.id]
    delete routeMap[msg.id]
    if (!msg.route){
      return
    }
  }

  msg.body = deCompose(msg)
  return msg
}

var defaultEncode = olemop.encode = function (reqId, route, msg) {
  var type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY

  // compress message by protobuf
  if (protobuf && clientProtos[route]) {
    msg = protobuf.encode(route, msg)
  } else if (decodeIO_encoder && decodeIO_encoder.lookup(route)) {
    var Builder = decodeIO_encoder.build(route)
    msg = new Builder(msg).encodeNB()
  } else {
    msg = Protocol.strencode(JSON.stringify(msg))
  }

  var compressRoute = 0
  if (dict && dict[route]) {
    route = dict[route]
    compressRoute = 1
  }

  return Message.encode(reqId, type, compressRoute, route, msg)
}

var connect = function (params, url, cb) {
  console.log('connect to ' + url)

  var params = params || {}
  var maxReconnectAttempts = params.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS
  reconnectUrl = url
  // Add protobuf version
  if (window.localStorage && window.localStorage.getItem('protos') && protoVersion === 0) {
    var protos = JSON.parse(window.localStorage.getItem('protos'))

    protoVersion = protos.version || 0
    serverProtos = protos.server || {}
    clientProtos = protos.client || {}

    if (protobuf) {
      protobuf.init({encoderProtos: clientProtos, decoderProtos: serverProtos})
    }
    if (decodeIO_protobuf) {
      decodeIO_encoder = decodeIO_protobuf.loadJson(clientProtos)
      decodeIO_decoder = decodeIO_protobuf.loadJson(serverProtos)
    }
  }
  // Set protoversion
  handshakeBuffer.sys.protoVersion = protoVersion

  var onopen = function (event) {
    if (reconnect) {
      olemop.emit('reconnect')
    }
    reset()
    var obj = Package.encode(Package.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(handshakeBuffer)))
    send(obj)
  }
  var onmessage = function (event) {
    processPackage(Package.decode(event.data), cb)
    // new package arrived, update the heartbeat timeout
    if (heartbeatTimeout) {
      nextHeartbeatTimeout = Date.now() + heartbeatTimeout
    }
  }
  var onerror = function (event) {
    olemop.emit('io-error', event)
    console.error('socket error: ', event)
  }
  var onclose = function (event) {
    olemop.emit('close',event)
    olemop.emit('disconnect', event)
    if (event.code !== 1000) {
      console.error('socket close: ', event)
    }
    if (!preventReconnect && params.reconnect && reconnectAttempts < maxReconnectAttempts) {
      reconnect = true
      reconnectAttempts++
      reconncetTimer = setTimeout(function () {
        connect(params, reconnectUrl, cb)
      }, reconnectionDelay)
      reconnectionDelay *= 2
    }
  }

  // Browser WebSocket
  socket = new WebSocket(url)
  socket.binaryType = 'arraybuffer'
  socket.onopen = onopen
  socket.onmessage = onmessage
  socket.onerror = onerror
  socket.onclose = onclose

  // wxclosesocket
  // socket = wx.connectSocket({ url })
  // socket.onOpen = onopen
  // socket.onMessage = onmessage
  // socket.onError = onerror
  // socket.onClose = onclose
}

olemop.preventReconnect = () => {
  preventReconnect = true
}

olemop.disconnect = function () {
  if (socket) {
    if (socket.disconnect) socket.disconnect()
    if (socket.close) socket.close()
    console.log('disconnect')
    socket = null
  }

  if (heartbeatId) {
    clearTimeout(heartbeatId)
    heartbeatId = null
  }
  if (heartbeatTimeoutId) {
    clearTimeout(heartbeatTimeoutId)
    heartbeatTimeoutId = null
  }
}

var reset = function () {
  preventReconnect = false
  reconnect = false
  reconnectionDelay = 1000 * 5
  reconnectAttempts = 0
  clearTimeout(reconncetTimer)
}

olemop.request = function (route, msg, cb) {
  if (arguments.length === 2 && typeof msg === 'function') {
    cb = msg
    msg = {}
  } else {
    msg = msg || {}
  }
  route = route || msg.route
  if (!route) {
    return
  }

  reqId++
  sendMessage(reqId, route, msg)

  callbacks[reqId] = cb
  routeMap[reqId] = route
}

olemop.notify = function (route, msg) {
  msg = msg || {}
  sendMessage(0, route, msg)
}

var sendMessage = function (reqId, route, msg) {
  if (useCrypto) {
    msg = JSON.stringify(msg)
    var sig = rsa.signString(msg, "sha256")
    msg = JSON.parse(msg)
    msg['__crypto__'] = sig
  }
  if (encode) {
    msg = encode(reqId, route, msg)
  }

  var packet = Package.encode(Package.TYPE_DATA, msg)
  send(packet)
}

var send = function (packet) {
  if (socket)
    socket.send(packet.buffer)
}

var handler = {}

var heartbeat = function (data) {
  if (!heartbeatInterval) {
    // no heartbeat
    return
  }

  var obj = Package.encode(Package.TYPE_HEARTBEAT)
  if (heartbeatTimeoutId) {
    clearTimeout(heartbeatTimeoutId)
    heartbeatTimeoutId = null
  }

  if (heartbeatId) {
    // already in a heartbeat interval
    return
  }
  heartbeatId = setTimeout(function () {
    heartbeatId = null
    send(obj)

    nextHeartbeatTimeout = Date.now() + heartbeatTimeout
    heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, heartbeatTimeout)
  }, heartbeatInterval)
}

var heartbeatTimeoutCb = function () {
  var gap = nextHeartbeatTimeout - Date.now()
  if (gap > gapThreshold) {
    heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, gap)
  } else {
    console.error('server heartbeat timeout')
    olemop.emit('heartbeat timeout')
    olemop.disconnect()
  }
}

var handshake = function (data) {
  data = JSON.parse(Protocol.strdecode(data))
  if (data.code === RES_OLD_CLIENT) {
    olemop.emit('error', 'client version not fullfill')
    return
  }

  if (data.code !== RES_OK) {
    olemop.emit('error', 'handshake fail')
    return
  }

  handshakeInit(data)

  var obj = Package.encode(Package.TYPE_HANDSHAKE_ACK)
  send(obj)
  if (initCallback) {
    initCallback(socket)
  }
}

var onData = function (data) {
  var msg = data
  if (decode) {
    msg = decode(msg)
  }
  processMessage(olemop, msg)
}

var onKick = function (data) {
  data = JSON.parse(Protocol.strdecode(data))
  olemop.emit('onKick', data)
}

handlers[Package.TYPE_HANDSHAKE] = handshake
handlers[Package.TYPE_HEARTBEAT] = heartbeat
handlers[Package.TYPE_DATA] = onData
handlers[Package.TYPE_KICK] = onKick

var processPackage = function (msgs) {
  if (Array.isArray(msgs)) {
    for (var i = 0; i < msgs.length; i++) {
      var msg = msgs[i]
      handlers[msg.type](msg.body)
    }
  } else {
    handlers[msgs.type](msgs.body)
  }
}

var processMessage = function (olemop, msg) {
  if (!msg.id) {
    // server push message
    olemop.emit(msg.route, msg.body)
    return
  }

  // if have a id then find the callback function with the request
  var cb = callbacks[msg.id]

  delete callbacks[msg.id]
  if (typeof cb !== 'function') {
    return
  }

  cb(msg.body)
  return
}

var processMessageBatch = function (olemop, msgs) {
  for (var i = 0; i < msgs.length; i++) {
    processMessage(olemop, msgs[i])
  }
}

var deCompose = function (msg) {
  var route = msg.route

  // Decompose route from dict
  if (msg.compressRoute) {
    if (!abbrs[route]){
      return {}
    }

    route = msg.route = abbrs[route]
  }
  if (protobuf && serverProtos[route]) {
    return protobuf.decodeStr(route, msg.body)
  } else if (decodeIO_decoder && decodeIO_decoder.lookup(route)) {
    return decodeIO_decoder.build(route).decode(msg.body)
  } else {
    return JSON.parse(Protocol.strdecode(msg.body))
  }

  return msg
}

var handshakeInit = function (data) {
  if (data.sys && data.sys.heartbeat) {
    // heartbeat interval
    heartbeatInterval = data.sys.heartbeat * 1000
    // max heartbeat timeout
    heartbeatTimeout = heartbeatInterval * 2
  } else {
    heartbeatInterval = 0
    heartbeatTimeout = 0
  }

  initData(data)

  if (typeof handshakeCallback === 'function') {
    handshakeCallback(data.user)
  }
}

// Initilize data used in olemop client
var initData = function (data) {
  if (!data || !data.sys) {
    return
  }
  dict = data.sys.dict
  var protos = data.sys.protos

  // Init compress dict
  if (dict) {
    dict = dict
    abbrs = {}

    for (var route in dict) {
      abbrs[dict[route]] = route
    }
  }

  // Init protobuf protos
  if (protos) {
    protoVersion = protos.version || 0
    serverProtos = protos.server || {}
    clientProtos = protos.client || {}

    // Save protobuf protos to localStorage
    window.localStorage.setItem('protos', JSON.stringify(protos))

    if (protobuf) {
      protobuf.init({encoderProtos: protos.client, decoderProtos: protos.server})
    }
    if (decodeIO_protobuf) {
      decodeIO_encoder = decodeIO_protobuf.loadJson(clientProtos)
      decodeIO_decoder = decodeIO_protobuf.loadJson(serverProtos)
    }
  }
}

module.exports = olemop
