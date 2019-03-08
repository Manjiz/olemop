const fs = require('fs')
const vm = require('vm')
const cp = require('child_process')

const log = function () {
  console.log([].join.call(arguments, ' '))
}

function addBeauty (prefix, buf) {
  const out = prefix + ' ' + buf
    .toString()
    .replace(/\s+$/, '')
    .replace(/\n/g, '\n' + prefix)
  return $(out).green
}

function spawnProcess (command, options, callback) {
  const child = options[0] ? cp.spawn(command, options) : cp.exec(command, options)

  let prefix = command === 'ssh' ? `[${options[0]}] ` : ''
  prefix = $(prefix).grey

  // child.stderr.on('data', function (chunk) {
  //   log(addBeauty(chunk))
  // })

  const res = []
  child.stdout.on('data', (chunk) => {
    res.push(chunk.toString())
    log(addBeauty(chunk))
  })

  function addBeauty(buf) {
    return prefix + buf
      .toString()
      .replace(/\s+$/, '')
      .replace(/\n/g, '\n' + prefix)
  }

  child.on('exit', (code) => {
    if (callback) {
      callback(code === 0 ? null : code, res && res.join('\n'))
    }
  })
}

// Stylize a string
function stylize (str, style) {
  const styles = {
    'bold'      : [1,  22],
    'italic'    : [3,  23],
    'underline' : [4,  24],
    'cyan'      : [96, 39],
    'blue'      : [34, 39],
    'yellow'    : [33, 39],
    'green'     : [32, 39],
    'red'       : [31, 39],
    'grey'      : [90, 39],
    'green-hi'  : [92, 32],
  }
  return '\033[' + styles[style][0] + 'm' + str + '\033[' + styles[style][1] + 'm'
}

function $ (str) {
  str = new(String)(str);
  ['bold', 'grey', 'yellow', 'red', 'green', 'cyan', 'blue', 'italic', 'underline'].forEach(function (style) {
    Object.defineProperty(str, style, {
      get () {
        return $(stylize(this, style))
      }
    })
  })
  return str
}

stylize.$ = $

class Starter {
  /**
   * begin notify to run agent
   */
  run (main, message, clients = ['127.0.0.1']) {
    const count = parseInt(message.agent, 10) || 1
    clients.forEach((ip) => {
      for (let i = 0; i < count; i++) {
        const cmd = `cd ${process.cwd()} && ${process.execPath} ${main} client > log/.log`
        if (ip === '127.0.0.1') {
          this.localrun(cmd)
        } else {
          this.sshrun(cmd, ip)
        }
      }
    })
  }

  sshrun (cmd, host, callback) {
    const hosts = [host]
    log('Executing ' + $(cmd).yellow + ' on ' + $(hosts.join(', ')).blue)
    let wait = 0
    data = []
    if (hosts.length > 1) {
      parallelRunning = true
    }
    hosts.forEach((host) => {
      wait += 1
      spawnProcess('ssh', [host, cmd], (err, out) => {
        if (!err) {
          data.push({ host, out })
        }
        done(err)
      })
    })

    let error
    const done = (err) => {
      error = error || err
      if (--wait === 0) {
        this.parallelRunning = false
        if (error) {
          this.abort('FAILED TO RUN, return code: ' + error)
        } else if (callback) {
          callback(data)
        }
      }
    }
  }

  localrun (cmd, callback) {
    log('Executing ' + $(cmd).green + ' locally')
    spawnProcess(cmd, ['', ''], (err, data) => {
      if (err) {
        this.abort('FAILED TO RUN, return code: ' + err)
      } else {
        if (callback) callback(data)
      }
    })
  }

  set (key, def) {
    if (typeof def === 'function') {
      this.__defineGetter__(key, def)
    } else {
      this.__defineGetter__(key, function () {
        return def
      })
    }
  }

  load (file) {
    if (!file) throw new Error('File not specified')
    log('Executing compile ' + file)
    const code = coffee.compile(fs.readFileSync(file).toString())
    const script = vm.createScript(code, file)
    script.runInNewContext(this)
  }

  abort (msg) {
    log($(msg).red)
    // process.exit(1)
  }
}

module.exports = new Starter()
