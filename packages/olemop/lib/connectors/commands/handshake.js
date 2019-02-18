const Package = require('@olemop/protocol').Package
const olemop = require('../../olemop')

const CODE_OK = 200
const CODE_USE_ERROR = 500
const CODE_OLD_CLIENT = 501

/**
 * Process the handshake request.
 *
 * @param {Object} opts option parameters
 * @param {Function(msg, cb(err, resp))} opts.handshake handshake callback. msg is the handshake message from client
 * @param {number} opts.hearbeat heartbeat interval (level?)
 * @param {string} opts.version required client level
 */
class Handshake {
  constructor(opts = {}) {
    this.userHandshake = opts.handshake

    if (opts.heartbeat) {
      this.heartbeatSec = opts.heartbeat
      this.heartbeat = opts.heartbeat * 1000
    }

    this.checkClient = opts.checkClient

    this.useDict = opts.useDict
    this.useProtobuf = opts.useProtobuf
    this.useCrypto = opts.useCrypto
  }

  static setupHeartbeat(self) {
    return self.heartbeatSec
  }

  static response(socket, sys, resp) {
    const res = { code: CODE_OK, sys }
    resp && (res.user = resp)
    socket.handshakeResponse(Package.encode(Package.TYPE_HANDSHAKE, new Buffer(JSON.stringify(res))))
  }

  static processError(socket, code) {
    const res = { code }
    socket.sendForce(Package.encode(Package.TYPE_HANDSHAKE, new Buffer(JSON.stringify(res))))
    process.nextTick(() => {
      socket.disconnect()
    })
  }

  handle(socket, msg) {
    if (!msg.sys) {
      Handshake.processError(socket, CODE_USE_ERROR)
      return
    }

    if (typeof this.checkClient === 'function') {
      if (!msg || !msg.sys || !this.checkClient(msg.sys.type, msg.sys.version)) {
        Handshake.processError(socket, CODE_OLD_CLIENT)
        return
      }
    }

    const opts = {
      heartbeat: Handshake.setupHeartbeat(this)
    }

    if (this.useDict) {
      const dictVersion = olemop.app.components.__dictionary__.getVersion()
      if (!msg.sys.dictVersion || msg.sys.dictVersion !== dictVersion) {
        // may be deprecated in future
        opts.dict = olemop.app.components.__dictionary__.getDict()

        opts.routeToCode = olemop.app.components.__dictionary__.getDict()
        opts.codeToRoute = olemop.app.components.__dictionary__.getAbbrs()
        opts.dictVersion = dictVersion
      }
      opts.useDict = true
    }

    if (this.useProtobuf) {
      const protoVersion = olemop.app.components.__protobuf__.getVersion()
      if (!msg.sys.protoVersion || msg.sys.protoVersion !== protoVersion) {
        opts.protos = olemop.app.components.__protobuf__.getProtos()
      }
      opts.useProto = true
    }

    if (this.useCrypto) {
      olemop.app.components.__connector__.setPubKey(socket.id, msg.sys.rsa)
    }

    if (typeof this.userHandshake === 'function') {
      this.userHandshake(msg, (err, resp) => {
        if (err) {
          process.nextTick(() => {
            Handshake.processError(socket, CODE_USE_ERROR)
          })
          return
        }
        process.nextTick(() => {
          Handshake.response(socket, opts, resp)
        })
      }, socket)
      return
    }

    process.nextTick(() => {
      Handshake.response(socket, opts)
    })
  }
}

module.exports = Handshake
