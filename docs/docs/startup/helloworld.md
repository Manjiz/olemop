---
id: helloworld
title: Hello World
sidebar_label: helloworld
---

## 新建项目

使用 olemop 的命令行工具可以快速创建一个项目，命令如下：

```bash
olemop init ./HelloWorld
```

或者你也可以使用下面的三个命令：

```bash
mkdir HelloWorld
cd HelloWorld
olemop init
```

这两种创建方式是等价的，更多关于 olemop 命令行使用的文档，请参阅 [命令行工具](guide/commandline.md)。在初始化项目的时候，用户需要选择其底层使用的通信协议，分为 socket.io 和 websocket。

然后，进入到 HelloWorld 文件夹，安装依赖包：

```bash
sh npm-install.sh
```

windows 用户，可以直接运行 `npm-install.bat`

## 项目目录结构

让我们来看看一个 olemop 项目的大致结构

新建立的项目结构如下图所示：

![项目目录结构](assets/helloworld-folder.png)

该目录结构很清楚地展示了游戏项目的前后端分层结构，分别在各个目录下填写相关代码，即可快速开发游戏。下面对各个目录进行简要分析：

### game-server

game-server 是用 olemop 框架搭建的游戏服务器，以文件 app.js 作为入口，运行游戏的所有逻辑和功能。在接下来的开发中，所有游戏逻辑、功能、配置等都在该目录下进行。

- app 子目录

这个目录下放置所有的游戏服务器代码的地方，用户在这里实现不同类型的服务器，添加对应的 Handler、Remote 等等。

- config 子目录

game-server 下 config 包括了游戏服务器的所有配置信息。配置信息以 JSON 文件的格式进行定义，包含有日志、master、server 等服务器的配置信息。该目录还可以进行扩展，对数据库配置信息、地图信息和数值表等信息进行定义。总而言之，这里是放着所有游戏服务器相关的配置信息的地方。

- logs 子目录

日志是项目中不可或缺的，可以对项目的运行情况进行很好的备份，也是系统运维的参考数据之一，logs 存放了游戏服务器所有的日志信息。

### shared

shared 存放一些前后端、game-server 与 web-server 共用代码，由于都是 javascript 代码，那么对于一些工具或者算法代码，就可以前后端共用，极大地提高了代码重用性。

### web-server

web-server 是用 ExpressJs 框架搭建的 web 服务器，以文件 app.js 作为入口，当然开发者可以自行选择其他 web 服务器实现。如果游戏的客户端不是 web 的话，如 Android，这个目录就不是必须的了。

## 启动项目

启动 game-server 服务器：

```bash
cd game-server
olemop start
```

启动 web-server 服务器：

```bash
cd web-server
node app 
```

在启动过程中可能会有端口号冲突导致启动不成功，只需在 config 里面修改使用的端口号即可。如果上面的启动都没有问题的话，我们就可以对我们的 HelloWorld 进行测试了。浏览器访问 `http://localhost:3001` 或 `http://127.0.0.1:3001`，点击 Test Game Server，弹框提示 *game server is ok* 说明运行成功。

## 查看服务器

可以使用 `olemop list` 查看已经启动的服务器，如下图所示：

![命令截图](assets/helloworld-list-snapshot.png)

服务器状态可以查看 5 种状态信息：

- serverId：服务器的 serverId，同 config 配置表中的 id
- serverType：服务器的 serverType，同 config 配置表中的 type
- pid：服务器对应的进程 pid
- heapUsed：该服务器已经使用的堆大小（单位：兆）
- uptime：该服务器启动时长（单位：分钟）

## 关闭项目

可以使用以下两种方式关闭项目：

```bash
cd game-server
olemop stop
```

或者

```bash
cd game-server
olemop kill
```

其中 `olemop stop` 比较优雅，`olemop kill` 比较粗暴，安全性低，开发环境下可以使用，产品环境慎用。

## 小结

到这里为止，我们已经成功安装了 olemop，并成功运行了 HelloWorld。接下来，建议你看一下 olemop 整体的一个较详细的概述。如果你已经迫不及待地想写代码，可以去 olemop 例子教程，那里以一个 chat 应用为例，一步一步地向你展示如何来使用 olemop 进行一个实际应用的开发，以及 olemop 的一些 API 的使用方式等。
