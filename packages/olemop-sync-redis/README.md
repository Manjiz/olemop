# data-sync with redis

**MODIFIED BASED ON https://github.com/NetEase/pomelo-sync AND https://github.com/jiangzhuo/pomelo-sync-redis**

- exec(key,uid,id,val,cb)
- flush(key,uid,id,val,cb)
- isDone
- flushByUid(uid,cb)

data sync module is simple sync memory data into store engine like mysql,redis,file.

As we known, updating data is very frequently in game application. Especial in MMORPG kind game. User game data,such as location,flood,equipment,etc. almost always change as time going. For the purpose of avoid such update action cost, we decide to keep a copy data in memory. And keep synchronized with a timer and log;

Data sync can support both timer call and instance invoke for the different situation. Most of time the developer don't pay attention to it;

Data sync also can support memory operation like NOSQL database such as redis,mongodb etc. most of time developer can seem as a memory database without transaction.

Data sync features include timer sync,set,get,mset,mget,hset,hget,incr,decr,flush,merger,showdown,info,etc. and the developer can extend it very easily.

## Installation

```
npm install @olemop/sync-redis
```

## Usage

``` javascript
const SyncRedis = require('@olemop/sync-redis')

// db connection etc
const dbclient = {}

const id = 10001
const OPT_KEY = 'updateUser'

const sync = new SyncRedis({
  client: dbclient,
  redisOptions: {
    port: '127.0.0.1'
  },
  mapping: {
    [OPT_KEY]: (dbclient, val) => {
      console.log(`mock save ${val}`)
    }
  },
  interval: 2000
})

sync.exec(OPT_KEY, id, { name: 'hello' })
``` 

`options` object properties

| Property     | Type    | Default    | Description |
| ------------ | ------- | ---------- | ----------- |
| debug        | boolean | false      | debug mode  |
| logger       | *       | console    | logger for debug mode |
| client       | *       | (required) | client of your database which would be passed to mapping function |
| redisOptions | object  | null       | [node_redis options](https://github.com/NodeRedis/node_redis#options-object-properties) |
| mergerMapKey | string  | (required) | ----------- |
| userSetKey   | string  | (required) | ----------- |
| flushSetKey  | string  | (required) | ----------- |
| mapping      | object  | null       | mapping functions |
| mappingPath  | string  | null       | alternatively, directory of mapping functions |
| rewriter     | *       | Rewriter   | _experimental_ interface functions: tick, sync, isDone, flush, tick |
| interval     | number  | 60000      | interval milliseconds for default SyncTimer |
| timer        | *       | SyncTimer  | _experimental_ expose a method `start` for beginning the interval sync |




## API

### sync.exec(key,id,val,cb)

Add a object to sync for timer exec call back. 

#### Arguments

+ key - the key function mapping for wanted to call back,it must be unique.
+ id - object primary key for merger operation. 
+ val -  the object wanted to synchronized. 
+ cb - the function call back when timer exec.

### sync.flush(key,id,val,cb)

immediately synchronized the memory data with out waiting timer and will remove
waiting queue data

#### Arguments

+ key - the key function mapping for wanted to call back,it must be unique.
+ id - object primary key for merger operation. 
+ val -  the object wanted to synchronized. 
+ cb - the function call back when timer exec.

### sync.isDone

get the db sync status when the queue is empty,it should return true;otherwise
return false;

## Notice 

system default sync time is 1000 * 60,
if you use mysql or redis sync,you should set options.client,the file sync is default but it doesn't load in current.
Mysql OR mapping in this modules do not support,user should realize it self.

## ADD

for more usage detail , reading source and benchmark and test case from
source is recommended;
