## Monitor

Simple, comprehensive monitoring tool for operating-system and process in nodejs.

## Installation

```bash
npm install -g @olemop/monitor
```

## Usage

```javascript
const monitor = require('@olemop/monitor')

monitor.psmonitor.getPsInfo({
  pid: process.pid,
  serverId: 'node-1'
}, (err, data) => {
  console.log('process information is: %j', data)
})

monitor.sysmonitor.getSysInfo((err, data) => {
  console.log('operating-system information is: %j', data)
})
```

## Features

- Simple and comprehensive
- Only for linux or mac
- SystemMonitor aims to monitor system info, such as hostname, loadAvg, mem, CPU(I/O), DISK(O/I) etc, according to the command 'iostat'
- ProcessMonitor aims to monitor process info, such as serverId, serverType, cpu%, mem%, vsz, rss etc, according to the command 'ps auxw'
