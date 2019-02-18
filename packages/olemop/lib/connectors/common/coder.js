const Message = require('@olemop/protocol').Message
const logger = require('@olemop/logger').getLogger('olemop', __filename)

const encode = function (reqId, route, msg) {
  return reqId ? composeResponse(this, reqId, route, msg) : composePush(this, route, msg)
}

const decode = function (msg) {
  msg = Message.decode(msg.body)
  let route = msg.route

  // decode use dictionary
  if (msg.compressRoute) {
    if (this.connector.useDict) {
      const abbrs = this.dictionary.getAbbrs()
      if (!abbrs[route]) {
        logger.error(`dictionary error! no abbrs for route: ${route}`)
        return null
      }
      route = msg.route = abbrs[route]
    } else {
      logger.error('fail to uncompress route code for msg: %j, server not enable dictionary.', msg)
      return null
    }
  }

  // decode use protobuf
  if (this.protobuf && this.protobuf.getProtos().client[route]) {
    msg.body = this.protobuf.decode(route, msg.body)
  } else {
    try {
      msg.body = JSON.parse(msg.body.toString('utf8'))
    } catch (ex) {
      msg.body = {}
    }
  }

  return msg
}

const composeResponse = function (server, msgId, route, msgBody) {
  if (!msgId || !route || !msgBody) {
    return null
  }
  msgBody = encodeBody(server, route, msgBody)
  return Message.encode(msgId, Message.TYPE_RESPONSE, 0, null, msgBody)
}

const composePush = function (server, route, msgBody) {
  if (!route || !msgBody) {
    return null
  }
  msgBody = encodeBody(server, route, msgBody)
  // encode use dictionary
  let compressRoute = 0
  if (server.dictionary) {
    const dict = server.dictionary.getDict()
    if (server.connector.useDict && dict[route]) {
      route = dict[route]
      compressRoute = 1
    }
  }
  return Message.encode(0, Message.TYPE_PUSH, compressRoute, route, msgBody)
}

const encodeBody = function (server, route, msgBody) {
    // encode use protobuf
  if (server.protobuf && server.protobuf.getProtos().server[route]) {
    msgBody = server.protobuf.encode(route, msgBody)
  } else {
    msgBody = new Buffer(JSON.stringify(msgBody), 'utf8')
  }
  return msgBody
}

module.exports = {
  encode,
  decode
}
