const uuidv1 = require('uuid/v1')

const getModule = (module) => {
  let rs = ''
  const strs = module.split('/')
  const lines = strs.slice(-3)
  lines.forEach((item) => {
    rs += '/' + item
  })
  return rs
}

const Tracer = function (logger, enabledRpcLog, source, remote, msg, id, seq) {
  this.isEnabled = enabledRpcLog

  if (!enabledRpcLog) return

  this.logger = logger
  this.source = source
  this.remote = remote
  this.id = id || uuidv1()
  this.seq = seq || 1
  this.msg = msg
}

Tracer.prototype.getLogger = function (role, module, method, des) {
  return {
    traceId: this.id,
    seq: this.seq++,
    role,
    source: this.source,
    remote: this.remote,
    module: getModule(module),
    method,
    args: this.msg,
    timestamp: Date.now(),
    description: des
  }
}

Tracer.prototype.info = function (role, module, method, des) {
  if (!this.isEnabled) return
  this.logger.info(JSON.stringify(this.getLogger(role, module, method, des)))
}

Tracer.prototype.debug = function (role, module, method, des) {
  if (!this.isEnabled) return
  this.logger.debug(JSON.stringify(this.getLogger(role, module, method, des)))
}

Tracer.prototype.error = function (role, module, method, des) {
  if (!this.isEnabled) return
  this.logger.error(JSON.stringify(this.getLogger(role, module, method, des)))
}

module.exports = Tracer
