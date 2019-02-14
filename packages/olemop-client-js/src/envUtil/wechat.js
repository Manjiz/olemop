exports.formatURI = (host, port) => {
  return `wss://${host}${port ? `/${port}` : ''}`
}
/**
 * 注意 getStorage 和 getStorageSync 的返回是不一样的
 */
exports.getStorageProtos = () => {
  try {
    return wx.getStorageSync('protos')
  } catch (err) {
  }
}

/**
 * @todo 待定异同步
 */
exports.setStorageProtos = (data) => {
  wx.setStorage({ key: 'protos', data })
}

exports.initSocket = (uri, onopen, onmessage, onerror, onclose) => {
  const socketTask = wx.connectSocket({ url: uri })
  // wx.onSocketOpen(onopen)
  // wx.onSocketMessage(onmessage)
  // wx.onSocketError(onerror)
  // wx.onSocketClose(onclose)
  socketTask.onOpen(onopen)
  socketTask.onMessage(onmessage)
  socketTask.onError(onerror)
  socketTask.onClose(onclose)
  return socketTask
}

exports.closeConnection = (socket) => {
  if (!socket) return
  // wx.closeSocket()
  socket.close()
}

exports.send = (socket, arrayBuf) => {
  if (!socket) return
  socket.send({ data: arrayBuf })
}
