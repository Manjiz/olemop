# @olemop/status-plugin

`@olemop/status-plugin` is a plugin for olemop. It provides global status service for olemop, which uses persistent storage to save users information.

## Installation

```bash
npm install @olemop/status-plugin
```

## Usage

```javascript
const status = require('@olemop/status-plugin')

app.use(status, {
  status: {
    statusKeyPrefix: 'OLEMOP:STATUS',
    host: '127.0.0.1',
    port: 6379,
    // ...options for module redis
  }
})
```

## API

### getSidsByUid(uid, cb)

get frontend server id by user id

- uid - user id
- cb - callback function

Return:

- err - error
- list - array of frontend server ids

### getStatusByUid(uid, cb)

- uid - user id
- cb - callback function

Return:

- err - error
- status - boolean, true if user is online (at least one session with a frontend) or false otherwise

### getStatusByUids(uids, cb)

- uids - array of user ids
- cb - callback function

Return:

- err - error
- statuses - object with uid as keys and boolean as value, true if user is online (at least one session with a frontend) or false otherwise

### pushByUids(uids, route, msg, cb)

- uids - array of user ids
- route - route string
- msg - messages would be sent to clients
- cb - callback function

Return:

- err - error
- fails - array of failed to send user ids

## Notice

status plugin use redis as a default persistent storage, you can change it with your own implementation.

```javascript
const status = require('@olemop/status-plugin')
const mysqlStatusManager = require('./mysqlStatusManager')

app.use(status, {
  status: {
    host: '127.0.0.1',
    port: 6379,
    channelManager: mysqlStatusManager
  }
})
```

cleanOnStartUp option: when you enable this option, status plugin would clean up the old data with the given prefix string.

```javascript
app.use(status, {
  status: {
    host: '127.0.0.1',
    port: 6379,
    cleanOnStartUp: true
  }
})
```
