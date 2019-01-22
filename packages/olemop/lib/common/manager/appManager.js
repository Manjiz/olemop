const async = require('async')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const transactionLogger = require('@olemop/logger').getLogger('transaction-log', __filename)
const transactionErrorLogger = require('@olemop/logger').getLogger('transaction-error-log', __filename)
const utils = require('../../util/utils')

const transaction = (name, conditions, handlers, retry) => {
	if (!retry) {
    retry = 1
  }
  if (typeof name !== 'string') {
    logger.error('transaction name is error format, name: %s.', name)
    return
  }
  if (typeof conditions !== 'object' || typeof handlers !== 'object') {
    logger.error('transaction conditions parameter is error format, conditions: %j, handlers: %j.', conditions, handlers)
    return
  }

  const cmethods = []
  const dmethods = []
  const cnames = []
  const dnames = []
  for (let key in conditions) {
    if (typeof key !== 'string' || typeof conditions[key] !== 'function') {
      logger.error('transaction conditions parameter is error format, condition name: %s, condition function: %j.', key, conditions[key])
      return
    }
    cnames.push(key)
    cmethods.push(conditions[key])
  }

  let i = 0
  // execute conditions
  async.forEachSeries(cmethods, (method, cb) => {
    method(cb)
    transactionLogger.info(`[${name}]:[${cnames[i]}] condition is executed.`)
    i++
  }, (err) => {
    if (err) {
      process.nextTick(() => {
        transactionLogger.error('[%s]:[%s] condition is executed with err: %j.', name, cnames[--i], err.stack)
        transactionErrorLogger.error(JSON.stringify({
          name: name,
          method: cnames[i],
          time: Date.now(),
          type: 'condition',
          description: err.stack
        }))
      })
      return
    } else {
      // execute handlers
      process.nextTick(() => {
        for (let key in handlers) {
          if (typeof key !== 'string' || typeof handlers[key] !== 'function') {
            logger.error('transcation handlers parameter is error format, handler name: %s, handler function: %j.', key, handlers[key])
            return
          }
          dnames.push(key)
          dmethods.push(handlers[key])
        }

        let flag = true
        const times = retry

        // do retry if failed util retry times
        async.whilst(() => {
          return retry > 0 && flag
        }, (callback) => {
          let j = 0
          retry--
          async.forEachSeries(dmethods, (method, cb) => {
            method(cb)
            transactionLogger.info(`[${name}]:[${dnames[j]}] handler is executed.`)
            j++
          }, (err) => {
            if (err) {
              process.nextTick(() => {
                transactionLogger.error('[%s]:[%s]:[%s] handler is executed with err: %j.', name, dnames[--j], times-retry, err.stack)
                transactionErrorLogger.error(JSON.stringify({
                  name: name,
                  method: dnames[j],
                  retry: times - retry,
                  time: Date.now(),
                  type: 'handler',
                  description: err.stack
                }))
                utils.invokeCallback(callback)
              })
              return
            }
            flag = false
            utils.invokeCallback(callback)
            process.nextTick(() => {
              transactionLogger.info(`[${name}] all conditions and handlers are executed successfully.`)
            })
          })
        }, (err) => {
          if (err) {
            logger.error('transaction process is executed with error: %j', err)
          }
          // callback will not pass error
        })
      })
    }
  })
}

module.exports = {
  transaction
}
