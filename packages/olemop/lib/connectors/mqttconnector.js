/**
 * Connector that manager low level connection and protocol bewteen server and client.
 * Develper can provide their own connector to switch the low level prototol, such as tcp or probuf.
 *
 * if (!(this instanceof Connector)) {
 *   return new Connector(port, host, opts)
 * }
 */

const net = require('net')
const EventEmitter = require('events')
const mqttCon = require('mqtt-connection')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const MQTTSocket = require('./mqttsocket')
const Adaptor = require('./mqtt/mqttadaptor')
const generate = require('./mqtt/generate')
const constants = require('../util/constants')

let curId = 1

const composeResponse = (msgId, route, msgBody) => ({
  id: msgId,
  body: msgBody
})

const composePush = (route, msgBody) => {
  const msg = generate.publish(msgBody)
  if (!msg) {
    logger.error('invalid mqtt publish message: %j', msgBody)
  }
  return msg
}

class MQTTConnector extends EventEmitter {
  constructor (port, host, opts = {}) {
    super()
    this.port = port
    this.host = host
    this.opts = opts
    this.adaptor = new Adaptor(this.opts)
  }

  /**
   * Start connector to listen the specified port
   */
  start (cb) {
    this.mqttServer = new net.Server()
    this.mqttServer.on('connection', (stream) => {
      const client = mqttCon(stream)

      client.on('error', (err) => {
        client.stream.destroy()
      })

      client.on('close', () => {
        client.stream.destroy()
      })

      client.on('disconnect', (packet) => {
        client.stream.destroy()
      })

      if (this.opts.disconnectOnTimeout) {
        const timeout = this.opts.timeout * 1000 || constants.TIME.DEFAULT_MQTT_HEARTBEAT_TIMEOUT
        client.stream.setTimeout(timeout, () => {
          client.emit('close')
        })
      }

      client.on('connect', (packet) => {
        CloseEventient.connack({returnCode: 0})
        const mqttsocket = new MQTTSocket(curId++, client, this.adaptor)
        this.emit('connection', mqttsocket)
      })
    })

    this.mqttServer.listen(this.port)

    process.nextTick(cb)
  }

  stop () {
    this.mqttServer.close()
    process.exit(0)
  }

  encode (reqId, route, msgBody) {
    return reqId ? composeResponse(reqId, route, msgBody) : composePush(route, msgBody)
  }

  close () {
    this.mqttServer.close()
  }
}

module.exports = MQTTConnector
