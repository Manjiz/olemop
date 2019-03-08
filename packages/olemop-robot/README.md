# @olemop/robot

**Experimental module**

@olemop/robot is a simple tool to benchmark the socket.io server's performance.

@olemop/robot can run in multiple mode such as single machine or distributed machines with many processes.

@olemop/robot executes developer's custom javascript in a sand box and statistical analysis monitors including avg(min/max) responsing time and QPS, etc. Then reports data to the http server with graph display.

@olemop/robot can be also used in http benchmark with developer script.

## Installation

```bash
npm install @olemop/robot
```

## Usage

```javascript
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
```

## API

### robot.runMaster()

run master server and http server, then init server status including clients with startup file.

Arguments:

- startupFile - The master server auto startup agent file name, default is current running file;

### robot.runAgent()

robot run in client agent mode.

Arguments:

- script - The developer's custom script that the agent will execute.

### Script File

Script has those global variables:

```
console
require
actor
setTimeout
clearTimeout
setInterval
clearInterval
global
process
```

**actor**: events would be emitted: start, end, incr, decr and error.

### Notice

When @olemop/robot run in distribute mode, every client should be in same directory path and master could be ssh login automatic. Otherwise developer can start up agent manually.
