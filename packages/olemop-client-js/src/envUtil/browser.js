exports.formatURI = (host, port) => {
  let uri = `ws://${host}`
  if (port) {
    uri += `:${port}`
  }
  return uri
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

exports.closeConnection = (socket) => {
  if (!socket) return
  if (socket.disconnect) socket.disconnect()
  if (socket.close) socket.close()
}

exports.send = (socket, arrayBuf) => {
  if (!socket) return
  socket.send(arrayBuf)
}
