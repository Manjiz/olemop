const bBuffer = require('./buffer')

const OutBuffer = bBuffer.outBuffer
const InBuffer = bBuffer.inBuffer

const Coder = {}

Coder.encodeClient = (id, msg, servicesMap) => {
	const outBuf = new OutBuffer()
	outBuf.writeUInt(id)
	const namespace = msg['namespace']
	const serverType = msg['serverType']
	const service = msg['service']
	const method = msg['method']
	const args = msg['args'] || []
	outBuf.writeShort(servicesMap[0][namespace])
	outBuf.writeShort(servicesMap[1][service])
	outBuf.writeShort(servicesMap[2][method])
	// outBuf.writeString(namespace)
	// outBuf.writeString(service)
	// outBuf.writeString(method)

	outBuf.writeObject(args)

	return outBuf.getBuffer()
}

Coder.encodeServer = (id, args) => {
	const outBuf = new OutBuffer()
	outBuf.writeUInt(id)
	outBuf.writeObject(args)
	return outBuf.getBuffer()
}

Coder.decodeServer = (buf, servicesMap) => {
	const inBuf = new InBuffer(buf)
	const id = inBuf.readUInt()
	const namespace = servicesMap[3][inBuf.readShort()]
	const service = servicesMap[4][inBuf.readShort()]
	const method = servicesMap[5][inBuf.readShort()]
	// const namespace = inBuf.readString()
	// const service = inBuf.readString()
	// const method = inBuf.readString()

	return {
		id,
		msg: {
			namespace,
			// serverType: serverType,
			service,
			method,
			args: inBuf.readObject()
		}
	}
}

Coder.decodeClient = (buf) => {
	const inBuf = new InBuffer(buf)
	return {
		id: inBuf.readUInt(),
		resp: inBuf.readObject()
	}
}

module.exports = Coder
