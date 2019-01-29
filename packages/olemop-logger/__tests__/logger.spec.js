const path = require('path')
const log4js = require('log4js')
const logger = require('../lib/logger')

describe('export log4js func', () => {
  test('getDefaultLogger', () => {
    expect(logger.getDefaultLogger).toBe(log4js.getDefaultLogger)
  })

  test('addAppender', () => {
    expect(logger.addAppender).toBe(log4js.addAppender)
  })

  test('loadAppender', () => {
    expect(logger.loadAppender).toBe(log4js.loadAppender)
  })

  test('clearAppenders', () => {
    expect(logger.clearAppenders).toBe(log4js.clearAppenders)
  })

  test('replaceConsole', () => {
    expect(logger.replaceConsole).toBe(log4js.replaceConsole)
  })

  test('restoreConsole', () => {
    expect(logger.restoreConsole).toBe(log4js.restoreConsole)
  })

  test('levels', () => {
    expect(logger.levels).toBe(log4js.levels)
  })

  test('setGlobalLogLevel', () => {
    expect(logger.setGlobalLogLevel).toBe(log4js.setGlobalLogLevel)
  })

  test('layouts', () => {
    expect(logger.layouts).toBe(log4js.layouts)
  })

  test('appenders', () => {
    expect(logger.appenders).toBe(log4js.appenders)
  })
})

// describe('getLogger', () => {
//   test('getLogger', () => {
//     const oLogger = logger.getLogger('olemop', 'xxx', 'yyy')
//     oLogger.level = 'debug'
//     oLogger.debug('some messages')
//     // expect(storedMessage).toBe('some messages')
//   })
// })

describe('configure', () => {
  test('configure', () => {
    log4js.configure = jest.fn()

    logger.configure({
      appenders: {
        olemop: {
          type: 'file',
          filename: "${opts:base}/logs/olemop-${opts:serverId}.log"
        }
      }
    }, {
      base: __dirname,
      serverId: 'myserver'
    })

    expect(log4js.configure).toHaveBeenCalled()
    expect(log4js.configure.mock.calls[0][0]).toMatchObject({
      appenders: {
        olemop: {
          type: 'file',
          filename: path.join(__dirname, '/logs/olemop-myserver.log')
        }
      }
    })
  })
})
