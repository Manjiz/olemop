---
id: component
title: 组件
---

# 组件

组件（component）是纳入服务器生命周期管理的服务单元。Olemop 服务器启动的过程实际上就是加载和启动一些列组件的过程（更多关于组件的细节请参考 Olemop Framework）。Olemop 框架内部提供了一系列的组件，并默认在启动过程中加载并启动它们，以提供 Olemop 中所需的各项服务。本文档将介绍这些内置组件的作用，以及开发者如何对这些组件进行配置。但对于一些不稳定的特性和配置选项暂时先隐藏。

Olemop 内置组件的代码放置在 [lib/components/](https://github.com/Manjiz/olemop/tree/master/packages/olemop/lib/components) 目录下。它们当中大部分充当一个包装器角色，将 Olemop 框架内部的服务包装后，使之纳入容器的生命周期管理并暴露给外界使用。

## 组件配置

开发者可以在 `app.js` 文件中对各个内置组件进行配置。配置的方式是在 app 中设置名为 *componentName*Config 的属性，该属性的 value 将被作为初始化参数传递给组件。其中 *componentName* 为对应组件的名字。例如，配置 `connector` 组件的属性的例子如下：

```javascript
app.set('connectorConfig', {
  connector: pomelo.connectors.hybridconnector,
  heartbeat: 3,
  useDict: true,
  useProtobuf: true
})
```

**注意**：具体的配置参数由对应的组件决定，可能会随组件的升级发生改变。

## 组件说明

### channel

提供 channel 相关的服务的组件。加载该组件后，会在 app 上下文加入 `channelService`，可以通过 `app.get('channelService')` 获取。`channelService` 相关的接口信息请参考 @todo。

**配置**

- broadcastFilter: broadcast 的过滤函数。会在执行 broadcast 操作时，在每个 frontend server 上，在将消息发送给每个 session 之前触发。返回 true 表示可以将消息发送给该session，否则消息将不会发送给对应的 session。参数：
  - session: 消息将发往的 session
  - msg: 待发消息
  - param: broadcast 附带参数，在 `channelService.broadcast(type, route, { filterParam: param }, cb)` 中传递

**Example**

```javascript
app.set('channelConfig', {
  broadcastFilter (session, msg, param) {
    // check some condition
    return true
  }
})
```

### connection

无配置项。提供统计 frontend server 连接数服务的组件，组件名 `__connection__`，在 frontend server 上会被加载，主要工作是将 `connectionService` 封装成组件。`@olemop/admin` 依赖这个组件进行 frontend server 的连接数和登录用户数进行统计。

### connector

管理 frontend server 底层的连接和通信协议的实现，组件名 `__connector__`。配置参数由所使用的 connector 实现决定。

**配置**

- connector: connector 工厂方法，创建并返回新的 connector 实例。参数：
	- port: 监听端口
	- host: 监听的 host 名
	- opts: 额外初始化参数

目前 Olemop 提供两个 connector 的实现：`sioconnector` 和 `hybridconnector`。

### dictionary

生成 route 字符串压缩编码的组件。该组件会遍历所有 handler 的 route 字符串，并为之生成唯一的压缩编码。同时也支持用户配置额外的 route 字符串，默认配置文件为`config/dictionary.json`，也可以通过配置来指定该文件的位置。

**注意**：dictionary 组件只有在使用 `hybridconnector` 并且配置 `useDict` 为 true 时才有效。

**配置**

指定用户自定义 route 字符串配置文件

```javascript
app.set('dictionaryConfig', {
  dict: path.join(app.getBase(), '/config/dictionary.json')
})
```

### backendSession

无配置项。提供 BackendSession 相关服务的组件。加载该组件后，会在 app 上下文中加入 `backendSessionService`，可以通过 `app.get('backendSessionService')` 获取。`backendSessionService` 相关的接口信息请参考@todo。

### master

无配置项。在 master 进程上加载。提供 master 相关功能，如：根据配置启动各个服务器进程，运行 `@olemop/admin` master 端并加载 master 端 modules，监控各个进程状态信息等。

### monitor

无配置项。在 master 之外的各个进程上加载。运行 `@olemop/admin` monitor 端并加载 monitor 端 modules。

### protobuf

无配置项。该组件负责加载 protobuf 数据定义文件和提供 protobuf 相关 encode 和 decode 服务（内部使用）。

**注意**：protobuf 组件只有在使用 `hybridconnector` 并且配置 `useProtobuf` 为 true 时才有效。

具体 `@olemop/protobuf` 的使用，请参考[这里](https://github.com/Manjiz/olemop/tree/master/packages/olemop-protobuf)。

### proxy

提供 rpc 客户端代理生成和 rpc 客户端请求路由计算服务。该模块加载后，会在 app 上下文加入 `rpc` 字段。`app.rpc` 是 rpc 代理对象的根节点，根据各个服务器路径下 `remote/` 目录下的服务代码自动生成，可以通过 `app.rpc.serverType.service.method` 的形式发起远程调用。

可以通过 `app.route` 方法对特定类型的服务器类型配置路由计算函数。路由计算函数的主要工作就是决定某一个消息应该发往哪一个远程服务器。

**Example**

为 area 服务器配置路由函数 routeFn。

```javascript
app.route('area', routeFn)
```

配置默认的路由函数，所有发往没配置路由函数的服务器类型的请求都会交给默认路由函数计算。

```javascript
app.route('default', defaultRouteFn)
```

路由函数的定义：

```javascript
const routeFn = function (session, msg, app, cb) {
  // 实现路由策略，计算得到目标服务器id
  cb(null, serverId)
}
```

### remote

提供远程服务暴露服务。根据当前服务器类型，加载对应 `remote/` 目录下的服务器代码，并根据配置的端口将远程服务暴露出来。该模块启动后，其他服务器即可连接配置的端口，向当前服务器发起 rpc 调用。

更多关于 `@olemop/rpc` 的使用细节，请参考[这里](https://github.com/Manjiz/olemop/tree/master/packages/olemop-rpc)。

### server

server 模块使服务器具备处理客户端请求的能力。该模块主要实现了 filter 服务，根据当前服务器类型，加载对应 `handler/` 目录下的代码，并决定一个请求应该是在当前服务器处理还是应该路由给其他服务器处理。

### session

无配置项。提供 globalSession 相关服务的组件。加载该组件后，会在 app 上下文中加入 `sessionService`，可以通过 `app.get('sessionService')` 获取。`sessionService` 相关的接口信息请参考@todo。


### sync

提供定时同步内存数据到数据库的服务。该组件加载后会在 app 向下文中加上 `sync` 属性，可以通过 `app.get('sync')` 来获取。

**配置**

```javascript
app.load(olemop.sync, { path: __dirname + '/app/dao/mapping', dbclient: dbclient })
```

其中，`path` 是实现底层数据同步服务器的目录。`sync` 会加载该目录下所有服务，并建立映射关系。`dbclient` 是用来实现数据同步服务的回调参数。

数据同步服务示例：

```javascript
module.exports = {
  updateBag (dbclient, val, cb) {
    const sql = 'update Bag set items = ? where id = ?'
    const items = typeof val.items === 'string' ? val.items : JSON.stringify(val.items)
    const args = [items, val.id]
    dbclient.query(sql, args, (err, res) => {
      if (err) {
        console.error(`write mysql failed!　${sql} ${JSON.stringify(val)}`)
      }
      cb(!!err)
    })
  }
}
```

通过 sync 更新数据

```javascript
app.get('sync').exec('bagSync.updateBag', player.bag.id, player.bag)
```

更多关于 `@olemop/sync` 的使用细节，请参考[这里](https://github.com/Manjiz/olemop/tree/master/packages/olemop-sync)。

## 用户组件

Olemop 的核心是由一系列松耦合的组件组成，同时我们也可以实现我们自己的组件来完成一些自己定制的功能。

首先，在 app 下建立 `components/HelloWorld.js` 文件, 大致代码如下：

```javascript
const DEFAULT_INTERVAL = 3000

const HelloWorld = function (app, opts) {
  this.app = app
  this.interval = opts.interval || DEFAULT_INTERVAL
  this.timerId = null
}

HelloWorld.prototype.name = '__HelloWorld__'

HelloWorld.prototype.start = function (cb) {
  console.log('Hello World Start')
  this.timerId = setInterval(() => {
    console.log(`${this.app.getServerId()}: Hello World!`)
  }, this.interval)
  process.nextTick(cb)
}

HelloWorld.prototype.afterStart = function (cb) {
  console.log('Hello World afterStart')
  process.nextTick(cb)
}

HelloWorld.prototype.stop = function (force, cb) {
  console.log('Hello World stop')
  clearInterval(this.timerId)
  process.nextTick(cb)
}

module.exports = (app, opts) => {
  return new HelloWorld(app, opts)
}
```

建议写成 class 的形式

```javascript
const DEFAULT_INTERVAL = 3000

class HelloWorld {
  constructor(app, opts) {
    this.name = '__HelloWorld__'
    this.app = app
    this.interval = opts.interval || DEFAULT_INTERVAL
    this.timerId = null
  }

  start(cb) {
    console.log('Hello World Start')
    this.timerId = setInterval(() => {
      console.log(`${this.app.getServerId()}: Hello World!`)
    }, this.interval)
    process.nextTick(cb)
  }

  afterStart(cb) {
    console.log('Hello World afterStart')
    process.nextTick(cb)
  }

  stop(force, cb) {
    console.log('Hello World stop')
    clearInterval(this.timerId)
    process.nextTick(cb)
  }
}

module.exports = (app, opts) => {
  return new HelloWorld(app, opts)
}
```

我们看到每一个组件一般都要定义 `start`，`afterStart`，`stop` 这些 hook 函数，供 olemop 管理其生命周期时进行调用。对于组件的启动，olemop 总是先调用其加载的每一个组件 提供的 start 函数，当全部调用完后，才会去调用其加载的每一个组件的 afterStart 方法，这里总是按顺序调用的。在 afterStart 中，一些需要全局就绪的工作可以放在这里完成，因为调用 afterStart 的时候，所有组件的 start 已经调用完毕。stop 用于程序结束时对组件进行清理时使用。这些 hook 函数都必须在最后执行 cb。虽然我们这个例子非常简单，但是足以说明如何在 olemop 中定制自己的组件并使用。我们在 HelloWorld 的 start 里面启用了一个定时器，每隔一段时间就向 console 打印一个 HelloWorld。然后在 stop 里关闭它。

然后，我们让 master 服务器来加载我们的这个组件

```javascript
// app.js
const helloWorld = require('./app/components/HelloWorld')

app.configure('production|development', 'master', () => {
  app.load(helloWorld, { interval: 5000 })
})
```

### 一些说明

- 这里定义的 HelloWorld 组件中，往外导出的是一个工厂函数，而不是一个对象。当 app 加载组件时，如果是一个工厂函数，那么 app 会将自己作为上下文信息以及后面的 opts 作为参数传给这个函数，使用这个函数的返回值作为组件对象。同样，也可以直接给 module.exports 赋予一个对象，那样的话，就可以直接使用而不用调用工厂函数，不过这样的话丧失了使用 app 和具体配置参数， 不够灵活，因此，使用工厂方法的方式是一个好选择。
- 对于 start 和 afterStart 的执行，olemop 总是会先按顺序执行完所有组件的 start 后，才会按顺序执行所有组件的 afterStart，因此可以在 afterStart 里执行一些需要其他组件执行了 start 后才可以执行的逻辑。
- 实际上，olemop 应用的整个运行过程可以认为是管理其组件的生命周期过程，olemop 的所有功能都是通过其内建的组件来实现的。用户可以轻松地定制自己的组件，然后将其 load 进去，这样就很轻松地实现了对 olemop 的扩展。
