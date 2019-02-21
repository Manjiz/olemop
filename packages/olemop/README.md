## Olemop -- a fast, scalable game server framework for node.js

> 推荐使用 PM2 来管理服务器实例。工具后面再加。

Olemop is a fast, scalable game server framework for NodeJS.

It provides the basic development framework and many related components, including libraries and tools.

Olemop is also suitable for real-time web applications; its distributed architecture makes olemop scale better than other real-time web frameworks.

## Features

### Complete support of game server and realtime application server architecture

- Multiple-player game: mobile, social, web, MMO rpg(middle size)
- Realtime application: chat,  message push, etc.

### Fast, scalable

- Distributed (multi-process) architecture, can be easily scale up
- Flexible server extension
- Full performance optimization and test

### Easy

- Simple API: request, response, broadcast, etc.
- Lightweight: high development efficiency based on node.js
- Convention over configuration: almost zero config

### Powerful

- Many clients support, including javascript, flash, android, iOS, cocos2d-x, C
- Many libraries and tools, including command line tool, admin tool, performance test tool, AI, path finding etc.
- Good reference materials: full docs, many examples and [an open-source MMO RPG demo](@todo)

### Extensible

- Support plugin architecture, easy to add new features through plugins. We also provide many plugins like online status, master high availability.
- Custom features, users can define their own network protocol, custom components very easy.

## Why should I use olemop?

Fast, scalable, real-time game server development is not an easy job, and a good container or framework can reduce its complexity.

Unfortunately, unlike web, finding a game server framework solution is difficult, especially an open source solution. Olemop fills this gap, providing a full solution for building game server frameworks.

Olemop has the following advantages:

- The architecture is scalable. It uses a multi-process, single thread runtime architecture, which has been proven in the industry and is especially suited to the node.js thread model.
- Easy to use, the development model is quite similar to web, using convention over configuration, with almost zero config. The [API](@todo) is also easy to use.
- The framework is extensible. Based on the node.js micro module principle, the core of olemop is small. All of the components, libraries and tools are individual npm modules, and anyone can create their own module to extend the framework.
- The reference materials and documentation are quite complete. In addition to the documentation, we also provide [an open-source MMO RPG demo](@todo) (HTML5 client), which is a far better reference material than any book.
