const olemop = require('@olemop/core')

/**
 * Init app for client.
 */
const app = olemop.createApp()
app.set('name', '$')

// app configuration
app.configure('production|development', 'connector', function () {
  app.set('connectorConfig', {
    connector: olemop.connectors.hybridconnector,
    heartbeat: 3,
    useDict: true,
    useProtobuf: true
  })
})

// start app
app.start()

process.on('uncaughtException', function (err) {
  console.error(` Caught exception: ${err.stack}`)
})
