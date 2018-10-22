# @olemop/plugin-sync

sync plugin for olemop

# Installation

```
npm install @olemop/plugin-sync
```

# Usage

```
const sync = require('@olemop/plugin-sync')

//app.js

app.use(sync, {
  sync: {
    key1: value1,
    key2: value2
  }
})

//get
app.get('globalChannelService')
```
