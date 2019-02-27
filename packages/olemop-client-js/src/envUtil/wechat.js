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

/**
 * @param {Object} socket
 * @param {number} [code] 默认会是 1000，跟 browser 不一样 @see https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
 * @param {string} [reason] 关闭原因
 */
exports.closeConnection = (socket, code, reason) => {
  if (!socket) return
  // wx.closeSocket()
  socket.close({ code, reason })
}

exports.send = (socket, arrayBuf) => {
  if (!socket) return
  socket.send({ data: arrayBuf })
}
