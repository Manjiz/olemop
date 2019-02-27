const EventEmitter = require('wolfy87-eventemitter')
const Protocol = require('@olemop/protocol')
const protobuf = require('@olemop/protobuf/lib/client/protobuf')
// const rsa = require('./olemop-rsasign/rsa')
const envUtil = require(`./envUtil/${__PLATFORM__}`)

// @todo const
let rsa

const JS_WS_CLIENT_TYPE = 'js-websocket'
const JS_WS_CLIENT_VERSION = '0.0.1'

const Package = Protocol.Package
const Message = Protocol.Message

if (typeof window !== 'undefined' && typeof sys !== 'undefined' && sys.localStorage) {
  window.localStorage = sys.localStorage
}

const RES_OK = 200
const RES_FAIL = 500
const RES_OLD_CLIENT = 501

if (typeof Object.create !== 'function') {
  Object.create = function (o) {
    function F() {}
    F.prototype = o
    return new F()
  }
}

const root = window

// object extend from object
const olemop = Object.create(EventEmitter.prototype)
root.olemop = olemop

let socket = null
let reqId = 0
const callbacks = {}
const handlers = {}

// Map from request id to route
const routeMap = {}

// route string to code
let dict = {}

// code to route string
let abbrs = {}

let serverProtos = {}
let clientProtos = {}
let protoVersion = 0

let heartbeatInterval = 0
let heartbeatTimeout = 0
let nextHeartbeatTimeout = 0
// heartbeat gap threashold
const gapThreshold = 100
let heartbeatId = null
let heartbeatTimeoutId = null
let handshakeCallback = null

let decode = null
let encode = null

let useCrypto

let preventReconnect = false
let reconnect = false
let reconncetTimer = null
let reconnectUrl = null
let reconnectAttempts = 0
let reconnectionDelay = 5000
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10

const handshakeBuffer = {
  sys: {
    type: JS_WS_CLIENT_TYPE,
    version: JS_WS_CLIENT_VERSION,
    rsa: {}
  },
  user: {
  }
}

let initCallback = null
olemop.init = (params, cb) => {
  initCallback = cb

  encode = params.encode || defaultEncode
  decode = params.decode || defaultDecode

  const url = envUtil.formatURI(params.host, params.port)

  handshakeBuffer.user = params.user

  if (params.encrypt) {
    useCrypto = true
    rsa.generate(1024, '10001')
    handshakeBuffer.sys.rsa = {
      rsa_n: rsa.n.toString(16),
      rsa_e: rsa.e
    }
  }

  handshakeCallback = params.handshakeCallback
  connect(params, url, cb)
}

const defaultDecode = olemop.decode = (data) => {
  // probuff decode
  const msg = Message.decode(data)

  if (msg.id > 0) {
    msg.route = routeMap[msg.id]
    delete routeMap[msg.id]
    if (!msg.route) return
  }

  msg.body = deCompose(msg)
  return msg
}

const defaultEncode = olemop.encode = (reqId, route, msg) => {
  const type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY

  // compress message by protobuf
  if (protobuf && clientProtos[route]) {
    msg = protobuf.encode(route, msg)
  } else {
    msg = Protocol.strencode(JSON.stringify(msg))
  }

  let compressRoute = 0
  if (dict && dict[route]) {
    route = dict[route]
    compressRoute = 1
  }

  return Message.encode(reqId, type, compressRoute, route, msg)
}

const connect = (params, url, cb) => {
  console.log(`connect to ${url}`)

  params = params || {}
  const maxReconnectAttempts = params.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS
  reconnectUrl = url
  // Add protobuf version
  if (protoVersion === 0) {
    let protos = envUtil.getStorageProtos()
    if (protos) {
      protos = JSON.parse(protos)

      protoVersion = protos.version || 0
      serverProtos = protos.server || {}
      clientProtos = protos.client || {}

      if (protobuf) {
        protobuf.init({ encoderProtos: clientProtos, decoderProtos: serverProtos })
      }
    }
  }

  // Set protoversion
  handshakeBuffer.sys.protoVersion = protoVersion

  const onopen = (event) => {
    if (reconnect) {
      olemop.emit('reconnect')
    }
    reset()
    send(Package.encode(Package.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(handshakeBuffer))))
  }
  const onmessage = (event) => {
    processPackage(Package.decode(event.data), cb)
    // new package arrived, update the heartbeat timeout
    if (heartbeatTimeout) {
      nextHeartbeatTimeout = Date.now() + heartbeatTimeout
    }
  }
  const onerror = (event) => {
    olemop.emit('io-error', event)
    console.error('socket error: ', event)
  }
  const onclose = (event) => {
    olemop.emit('close',event)
    olemop.emit('disconnect', event)
    if (event.code !== 1000) {
      console.error('socket close: ', event)
    }
    if (!preventReconnect && params.reconnect && reconnectAttempts < maxReconnectAttempts) {
      reconnect = true
      reconnectAttempts++
      reconncetTimer = setTimeout(() => {
        connect(params, reconnectUrl, cb)
      }, reconnectionDelay)
      reconnectionDelay *= 2
    }
  }

  socket = envUtil.initSocket(url, onopen, onmessage, onerror, onclose)
}

olemop.preventReconnect = () => {
  preventReconnect = true
}

olemop.disconnect = () => {
  if (socket) {
    envUtil.closeConnection(socket)
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

const reset = () => {
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

olemop.notify = (route, msg) => {
  msg = msg || {}
  sendMessage(0, route, msg)
}

const sendMessage = (reqId, route, msg) => {
  if (useCrypto) {
    msg = JSON.stringify(msg)
    const sig = rsa.signString(msg, 'sha256')
    msg = JSON.parse(msg)
    msg['__crypto__'] = sig
  }
  if (encode) {
    msg = encode(reqId, route, msg)
  }

  send(Package.encode(Package.TYPE_DATA, msg))
}

const send = (packet) => {
  envUtil.send(socket, packet.buffer)
}

const heartbeat = (data) => {
  // no heartbeat
  if (!heartbeatInterval) return

  if (heartbeatTimeoutId) {
    clearTimeout(heartbeatTimeoutId)
    heartbeatTimeoutId = null
  }

  // already in a heartbeat interval
  if (heartbeatId) return

  heartbeatId = setTimeout(() => {
    heartbeatId = null
    send(Package.encode(Package.TYPE_HEARTBEAT))

    nextHeartbeatTimeout = Date.now() + heartbeatTimeout
    heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, heartbeatTimeout)
  }, heartbeatInterval)
}

const heartbeatTimeoutCb = () => {
  const gap = nextHeartbeatTimeout - Date.now()
  if (gap > gapThreshold) {
    heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, gap)
  } else {
    console.error('server heartbeat timeout')
    olemop.emit('heartbeat timeout')
    olemop.disconnect()
  }
}

const handshake = (data) => {
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

  send(Package.encode(Package.TYPE_HANDSHAKE_ACK))

  if (initCallback) {
    initCallback(socket)
  }
}

const onData = (msg) => {
  if (decode) {
    msg = decode(msg)
  }
  processMessage(olemop, msg)
}

const onKick = (data) => {
  data = JSON.parse(Protocol.strdecode(data))
  olemop.emit('onKick', data)
}

handlers[Package.TYPE_HANDSHAKE] = handshake
handlers[Package.TYPE_HEARTBEAT] = heartbeat
handlers[Package.TYPE_DATA] = onData
handlers[Package.TYPE_KICK] = onKick

const processPackage = (msgs) => {
  if (Array.isArray(msgs)) {
    msgs.forEach((msg) => {
      handlers[msg.type](msg.body)
    })
  } else {
    handlers[msgs.type](msgs.body)
  }
}

const processMessage = (olemop, msg) => {
  if (!msg.id) {
    // server push message
    olemop.emit(msg.route, msg.body)
    return
  }

  // if have a id then find the callback function with the request
  const cb = callbacks[msg.id]

  delete callbacks[msg.id]
  if (typeof cb !== 'function') return

  cb(msg.body)
}

const processMessageBatch = (olemop, msgs) => {
  msgs.forEach((msg) => {
    processMessage(olemop, msg)
  })
}

const deCompose = (msg) => {
  let route = msg.route

  // Decompose route from dict
  if (msg.compressRoute) {
    if (!abbrs[route]) {
      return {}
    }

    route = msg.route = abbrs[route]
  }
  if (protobuf && serverProtos[route]) {
    return protobuf.decodeStr(route, msg.body)
  } else {
    return JSON.parse(Protocol.strdecode(msg.body))
  }
}

const handshakeInit = (data) => {
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
const initData = (data) => {
  if (!data || !data.sys) return
  dict = data.sys.dict
  const protos = data.sys.protos

  // Init compress dict
  if (dict) {
    abbrs = {}
    for (let route in dict) {
      abbrs[dict[route]] = route
    }
  }

  // Init protobuf protos
  if (protos) {
    protoVersion = protos.version || 0
    serverProtos = protos.server || {}
    clientProtos = protos.client || {}

    // Save protobuf protos to localStorage
    envUtil.setStorageProtos(JSON.stringify(protos))

    if (protobuf) {
      protobuf.init({encoderProtos: protos.client, decoderProtos: protos.server})
    }
  }
}

module.exports = olemop
