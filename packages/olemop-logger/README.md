# @olemop/logger

@olemop/logger is a [log4js](https://github.com/nomiddlename/log4js-node) wrapper for olemop which provides some useful features.  

## Installation

```bash
npm install @olemop/logger
```

## Features

### Log prefix

besides category, you can output prefix as you like in your log. prefix can be filename, serverId, serverType, host etc. To use this feature, you just pass prefix params to getLogger function.

```javascript
const logger = require('@olemop/logger').getLogger(category, prefix1, prefix2, ...)
```

log output msg will output with prefix ahead   

### Get line number in debug

when in debug environment, you may want to get the line number of the log. To use this feature, add this code.

```javascript
process.env.LOGGER_LINE = true
```

In olemop, you just configure the log4js file and set **lineDebug** for true

```json
{
  "appenders": [
  ],

  "levels": {
  }, 

  "replaceConsole": true,

  "lineDebug": true
}
```

### Log raw messages

in raw message mode, your log message will be simply your messages, no prefix and color format strings. To use this feature, add this code:

```javascript
process.env.RAW_MESSAGE = true
```

In olemop, you just configure the log4js file and set **rawMessage** for true

```json
{
  "appenders": [
  ],

  "levels": {
  }, 

  "replaceConsole": true,

  "rawMessage": true
}
```

### Dynamic configure logger level

In olemop logger configuration file log4js.json, you can add reloadSecs option. The reloadSecs means reload logger configuration file every given time. For example:

```json
{
	"reloadSecs": 30
}
```

the above configuration means reload the configuration file every 30 seconds. You can dynamic change the logger level, but it does not support dynamiclly changing configuration of appenders.

## Example

See `./example`
