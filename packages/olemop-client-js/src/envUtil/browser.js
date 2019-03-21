exports.formatURI = (host, port) => {
  return `ws://${host}${port ? `:${port}` : ''}`
}

exports.getStorageProtos = () => {
  return window.localStorage.getItem('protos')
}

exports.setStorageProtos = (data) => {
  window.localStorage.setItem('protos', data)
}

exports.initSocket = (uri, onopen, onmessage, onerror, onclose) => {
  const socket = new WebSocket(uri)
  socket.binaryType = 'arraybuffer'
  socket.onopen = onopen
  socket.onmessage = onmessage
  socket.onerror = onerror
  socket.onclose = onclose
  return socket
}

/**
 * @param {Object} socket
 * @param {number} [code] 默认会是 1005 @see https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
 * @param {string} [reason] close reason
 */
exports.closeConnection = (socket, code, reason) => {
  if (!socket) return
  if (socket.disconnect) socket.disconnect()
  if (socket.close) socket.close(code, reason)
}

exports.send = (socket, arrayBuf) => {
  if (!socket) return
  socket.send(arrayBuf)
}
