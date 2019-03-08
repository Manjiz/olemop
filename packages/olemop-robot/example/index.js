const Robot = require('../').Robot
const config = require('./config.json')

const robot = new Robot(config.conf[config.env])

let mode = 'master'
if (process.argv.length > 2) {
  mode = process.argv[2]
  if (mode !== 'master' && mode !== 'client') {
    throw new Error(' mode must be master or client')
  }
}

if (mode === 'master') {
  robot.runMaster(__filename)
} else {
  robot.runAgent(config.script)
}
