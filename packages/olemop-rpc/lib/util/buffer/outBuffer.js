const utils = require('../utils')
const Codec = require('./util/codec')

const BUFFER_SIZE_DEFAULT = 32

const OutBuffer = function (size) {
	this.offset = 0
	this.size = size || BUFFER_SIZE_DEFAULT
	this.buf = new Buffer(this.size)
}

OutBuffer.prototype.getData = function () {
	return this.buf
}

OutBuffer.prototype.getBuffer = function () {
	return this.buf.slice(0, this.offset)
}

OutBuffer.prototype.getLength = function () {
	return this.offset
}

OutBuffer.prototype.write = function (data, offset, len) {
	this.ensureCapacity(len)
	this.buf.write(data, offset, len)
	this.offset += len
}

OutBuffer.prototype.writeBoolean = function (v) {
	this.writeByte(v ? 1 : 0)
}

OutBuffer.prototype.writeByte = function (v) {
	this.ensureCapacity(1)
	this.buf.writeUInt8(v, this.offset++, true)
}

OutBuffer.prototype.writeBuffer = function (bytes) {
	const len = bytes.length
	this.ensureCapacity(len + 4)
	this.writeUInt(len)
	const buffer = this.buf
	let offset = this.offset
	for (let i = 0; i < len; i++) {
		buffer.writeUInt8(bytes[i], offset++, true)
	}
	this.offset = offset
}

OutBuffer.prototype.writeBytes = function (bytes) {
	const len = bytes.length
	const buffer = this.buf
	let offset = this.offset
	for (let i = 0; i < len; i++) {
		buffer.writeUInt8(bytes[i], offset++, true)
	}
	this.offset = offset
}

OutBuffer.prototype.writeChar = function (v) {
	this.writeByte(v)
}

OutBuffer.prototype.writeChars = function (bytes) {
	this.writeBuffer(bytes)
}

OutBuffer.prototype.writeVInt = function (v) {
	const bytes = Codec.encodeUInt32(v)
	this.writeBytes(bytes)
}

OutBuffer.prototype.writeDouble = function (v) {
	this.ensureCapacity(8)
	this.buf.writeDoubleLE(v, this.offset, true)
	this.offset += 8
}

OutBuffer.prototype.writeFloat = function (v) {
	this.ensureCapacity(4)
	this.buf.writeFloatLE(v, this.offset, true)
	this.offset += 4
}

OutBuffer.prototype.writeInt = function (v) {
	this.ensureCapacity(4)
	this.buf.writeInt32LE(v, this.offset, true)
	this.offset += 4
}

OutBuffer.prototype.writeUInt = function (v) {
	this.writeVInt(v)
}

OutBuffer.prototype.writeSInt = function (v) {
	const bytes = Codec.encodeSInt32(v)
	this.writeBytes(bytes)
}

OutBuffer.prototype.writeShort = function (v) {
	this.ensureCapacity(2)
	this.buf.writeInt16LE(v, this.offset, true)
	this.offset += 2
}

OutBuffer.prototype.writeUShort = function (v) {
	this.ensureCapacity(2)
	this.buf.writeUInt16LE(v, this.offset, true)
	this.offset += 2
}

OutBuffer.prototype.writeString = function (str) {
	const len = Buffer.byteLength(str)
	this.ensureCapacity(len + 4)
	this.writeUInt(len)
	this.buf.write(str, this.offset, len)
	this.offset += len
}

OutBuffer.prototype.writeObject = function (object) {
	const type = utils.getType(object)
	if (!type) {
		throw new Error(`invalid writeObject ${object}`)
	}

	this.writeByte(type)

	const typeMap = utils.typeMap

	if (typeMap['null'] === type) return

	if (typeMap['buffer'] === type) {
		this.writeBuffer(object)
		return
	}

	if (typeMap['array'] === type) {
		const len = object.length
		this.writeVInt(len)
		for (let i = 0; i < len; i++) {
			this.writeObject(object[i])
		}
		return
	}

	if (typeMap['string'] === type) {
		this.writeString(object)
		return
	}

	if (typeMap['object'] === type) {
		this.writeString(JSON.stringify(object))
		// logger.error('invalid writeObject object must be bearcat beans and should implement writeFields and readFields interfaces')
		return
	}

	if (typeMap['bean'] === type) {
		this.writeString(object['$id'])
		object.writeFields(this)
		return
	}

	if (typeMap['boolean'] === type) {
		this.writeBoolean(object)
		return
	}

	if (typeMap['float'] === type) {
		this.writeFloat(object)
		return
	}

	if (typeMap['uint'] === type) {
		this.writeUInt(object)
		return
	}

	if (typeMap['sint'] === type) {
		this.writeSInt(object)
		return
	}
}

OutBuffer.prototype.ensureCapacity = function (len) {
	const minCapacity = this.offset + len
	if (minCapacity > this.buf.length) {
		this.grow(minCapacity) // double grow
	}
}

OutBuffer.prototype.grow = function (minCapacity) {
	const oldCapacity = this.buf.length
	let newCapacity = oldCapacity << 1
	if (newCapacity - minCapacity < 0) {
		newCapacity = minCapacity
	}

	if (newCapacity < 0 && minCapacity < 0) {
		throw new Error('OutOfMemoryError')
		// newCapacity = 0x7fffffff // Integer.MAX_VALUE
	}

	const newBuf = new Buffer(newCapacity)
	this.buf.copy(newBuf)
	this.buf = newBuf
}

OutBuffer.prototype.copy = function (target, offset, sourceStart, sourceEnd) {
	const len = sourceEnd - sourceStart
	target.ensureCapacity(len)
	this.buf.copy(target.buf, offset, sourceStart, sourceEnd)
	target.offset += len
}

module.exports = OutBuffer
