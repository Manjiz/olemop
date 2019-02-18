/**
 * @todo: consider rewriting these functions using buffers instead OF arrays
 */

const protocol = require('./protocol')

module.exports.publish = (opts = {}) => {
  const dup = opts.dup ? protocol.DUP_MASK : 0
  const qos = opts.qos || 0
  const retain = opts.retain ? protocol.RETAIN_MASK : 0
  const topic = opts.topic
  let payload = opts.payload || new Buffer(0)
  const id = typeof opts.messageId === 'undefined' ? randint() : opts.messageId
  const packet = {header: 0, payload: []}

  /* Check required fields */
  if (typeof topic !== 'string' || topic.length <= 0) return null
  /* if payload is a string, we'll convert it into a buffer */
  if (typeof payload === 'string') {
    payload = new Buffer(payload)
  }
  /* accepting only a buffer for payload */
  if (!Buffer.isBuffer(payload)) return null
  if (typeof qos !== 'number' || qos < 0 || qos > 2) return null
  if (typeof id !== 'number' || id < 0 || id > 0xFFFF) return null

  /* Generate header */
  packet.header = protocol.codes.publish << protocol.CMD_SHIFT | dup | qos << protocol.QOS_SHIFT | retain

  /* Topic name */
  packet.payload = packet.payload.concat(genString(topic))

  /* Message ID */
  if (qos > 0) packet.payload = packet.payload.concat(genNumber(id))

  const buf = new Buffer([packet.header]
    .concat(genLength(packet.payload.length + payload.length))
    .concat(packet.payload))

  return Buffer.concat([buf, payload])
}

/* Requires length be a number > 0 */
const genLength = (length) => {
  if (typeof length !== 'number') return null
  if (length < 0) return null

  const len = []
  let digit = 0

  do {
    digit = length % 128 | 0
    length = length / 128 | 0
    if (length > 0) {
      digit = digit | 0x80
    }
    len.push(digit)
  } while (length > 0)

  return len
}

/* based on code in (from http://farhadi.ir/downloads/utf8.js) */
const genString = function (str, withoutLength) {
  if (arguments.length < 2) withoutLength = false
  if (typeof str !== 'string') return null
  if (typeof withoutLength !== 'boolean') return null

  const string = []
  let length = 0
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 128) {
      string.push(code)
      ++length
    } else if (code < 2048) {
      string.push(192 + ((code >> 6 )     ))
      ++length
      string.push(128 + ((code      ) & 63))
      ++length
    } else if (code < 65536) {
      string.push(224 + ((code >> 12)     ))
      ++length
      string.push(128 + ((code >> 6 ) & 63))
      ++length
      string.push(128 + ((code      ) & 63))
      ++length
    } else if (code < 2097152) {
      string.push(240 + ((code >> 18)     ))
      ++length
      string.push(128 + ((code >> 12) & 63))
      ++length
      string.push(128 + ((code >> 6 ) & 63))
      ++length
      string.push(128 + ((code      ) & 63))
      ++length
    } else {
      throw new Error(`Can't encode character with code ${code}`)
    }
  }
  return withoutLength ? string : genNumber(length).concat(string)
}

const genNumber = (num) => {
  return [num >> 8, num & 0x00FF]
}

const randint = () => Math.floor(Math.random() * 0xFFFF)
