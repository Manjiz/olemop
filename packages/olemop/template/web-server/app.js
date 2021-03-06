const express = require('express')
const bodyParser = require('body-parser')
const methodOverride = require('method-override')
const errorHandler = require('errorhandler')
const app = express()
const router = express.Router()

router.get('/', function (req, res, next) {
  next()
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(methodOverride())
app.use(router)
app.use(errorHandler())

app.set('port', 3001)
app.set('view engine', 'jade')
app.set('views', `${__dirname}/public`)
app.set('view options', { layout: false })
app.set('basepath', `${__dirname}/public`)

if ('development' === app.get('env')) {
  app.use(express.static(`${__dirname}/public`))
}

if ('production' === app.get('env')) {
  const oneYear = 31557600000
  app.use(express.static(`${__dirname}/public`, { maxAge: oneYear }))
}

app.listen(app.get('port'), function () {
  console.log("Web server has started.\nPlease log on http://127.0.0.1:3001/index.html")
})
