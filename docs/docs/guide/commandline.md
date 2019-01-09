---
id: commandline
title: 命令行工具
sidebar_label: commandline
---

## 概述

命令行工具包括的命令支持绝大多数的应用开发操作，包括创建初始化项目、启动应用、停止应用、关闭应用等。可通过 `olemop --help` 查看更多。

## 命令行安装

```bash
npm install -g @olemop/core
```

## 命令介绍

- init: 创建新项目
- start: 启动应用及服务器
- list: 列出当前应用开启的所有服务器的信息，包括服务器Id、服务器类型、pid、堆使用情况、启动时长
- stop: 关闭应用及服务器或者停止指定的服务器
- kill: 强制关闭应用及服务器
- add: 运行时动态添加服务器
- masterha: 当启用 masterha 高可用的时候，用来启动 master 服务器的 slave 节点
- --version
- --help

## 命令使用说明

### init

根据给出的路径或文件名创建新项目，支持相对路径和绝对路径。默认情况下为当前路径，项目名称为当前文件夹名称。

```bash
olemop init [dirname]
```

在创建新项目时，需要选择新项目使用的与客户端通信时使用的 connector，1代表 Websocket (native socket)，2代表 socket.io。当目录下有同名文件夹存在时，会提示是否覆盖，还是取消创建。

### start

```bash
olemop start [-e,--env <env>] [-d,--directory <code directory>]
             [-D,--daemon]
```

其中，-e 用来选择启动时使用的 env，如 production，development，stress-test 等；-d 用来指定项目目录；-D 用来开启 daemon 模式启动，如果开启了 daemon，那么进程将转入后台运行，所有的日志将不再打印到 console 上，只能通过对应的日志文件查看日志。

用户可以在 `<project_dir>/game-server/config/servers.json` 中为不同的服务器中添加不同参数，这些参数是 NodeJs 和 v8 支持的参数，是用来指定和影响 NodeJs 及 v8 的行为的。例如，当我们想对某一个服务器开启调试的时候，就可以在服务器配置中，增加 args 配置项，并在 args 中配置开启调试的端口等，示例如下:

```json
{"connector":[{"id":"connector-server-1","host":"127.0.0.1","port":4050,"clientPort":3050,"args":"--debug=[port]"}]}
```

### list

当应用启动后，该命令列出所有服务器信息。由于当执行此操作时，olemop 是作为监控管理框架的一个客户端的，在连接注册到 master 上的时候，需要进行身份验证。默认生成的项目中，有一个默认的用户名 `admin`，口令也为 `admin`，因此在不指定用户名和口令的时候，默认使用的用户名和口令均为 admin，下面的 stop 命令和 kill 命令均需要使用用户名和口令验证，默认值与此处相同。应用的管理用户可以通过修改 `config/adminUser.json` 文件进行配置，具体的配置格式可以参考 olemop init 生成的项目中的相关配置。

执行本命令时，还需要指定 master 服务器的 ip 和 port，这样可以是的 olemop list 可以在任意地方执行。olemop stop/kill/add 等也同样需要指定 master 服务器的 ip 和 port，默认使用 `127.0.0.1:3005` 作为master服务器的地址。

```bash
olemop list [-u,--username <username>] [-p,--password <password>]
            [-h,--host <master-host>] [-P,--port <master-port>]
```

### stop

stop 用来停止当前应用，优雅地关闭应用。和 kill 命令不同，这种关闭首先会切断客户端与服务器的连接，然后逐一关闭所有服务器。如果指定了服务器 serverId 的话，则会关闭特定的服务器，而不是关闭所有的服务器。与 list 命令一样，需要权限验证，默认的用户名和密码均为 admin，也需要指定 master 服务器的位置，跟 olemop list 一样，默认使用 127.0.0.1:3005。

```bash
olemop stop [-u,--username <username>] [-p,--password <password>]
            [-h,--host <master-host>] [-P,--port <master-port>]
            [<serverIds>...]
```

### kill

该命令强制关闭应用。在本地进行应用开发过程中，如果遇到 kill 之后还有服务器进程没有关闭的情况，可以增加 `--force` 选项，强制关闭所有服务器进程。该操作相当地暴力，可能产生数据丢失等不好的影响，可以在开发调试时使用，不推荐在线上使用该命令。该命令同样也需要进行身份验证以及指定 master 服务器的位置，具体方式同 list 和 stop。**该命令需在项目的根目录或 game-server 下使用**。

```bash
olemop kill [-u,--username <username>] [-p,--password <password>]
            [-h,--host <master-host>] [-P,--port <master-port>]
            [-f,--force]
```

### add

该命令用来运行时动态增加服务器，与 olemop list 等命令类似，olemop add 也需要身份验证以及指定 master 服务器的地址。

```bash
olemop add [-u,--username <username>] [-p,--password <password>]
           [-h,--host <master-host>] [-P,--port <master-port>]
           [<server-args>...]
```

args 参数是用来指定新增服务器的参数的，包括服务器类型，服务器 id 等， 支持一次增加一台或多台同类型的服务器，例子如下：

```bash
olemop add host=127.0.0.1 port=8000++ clientPort=9000++ frontend=true clusterCount=3 serverType=connector 
olemop add host=127.0.0.1 port=8000 clientPort=9000 frontend=true serverType=connector id=added-connector-server
```

### masterha

当启用了 master 服务器的高可用后，该命令用来启动 master 服务器的 slave 节点，需要在 game-server/config 目录下配置 masterha.json。其他的命令行参数类似于 olemop start。

```bash
olemop masterha [-d,--direcotry <code directory>]
```

## 注意

一般来说在开发环境中，master 服务器的地址会一直是 127.0.0.1:3005，使用的管理用户的 username 和 password 直接使用默认的 admin 即可，这样的话，开发调试时，在执行具体的 olemop 命令的时候，maser 服务器的地址信息以及管理用户信息都可以省略。
