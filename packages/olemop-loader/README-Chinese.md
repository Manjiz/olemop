# @olemop/loader - loader module for olemop

olemop 中使用 Convention over Configuration 的形式管理工程目录，不同的功能按约定放在不同的目录下。@olemop/loader 为 olemop 提供了按目录加载模块的功能。

@olemop/rpc 可以批量加载指定目录下的模块，挂到一个空对象下返回（但不会递归加载子目录），同时提供模块命名机制。

## 规则说明

- 模块命名

模块默认以文件名为名。如：加载 lib/a.js 后，返回的结果为：{ a: require('./lib/a') }。

如果模块中定义了 name 属性，则会以 name 作为模块的名称。如：

```javascript
// a.js
exports.name = 'test'
```

返回的结果为：{ test: require('./lib/a') }

- 模块定义

如果模块以 function 的形式暴露出去，则这个 function 会被当作构造模块实例的工厂方法，Loader会调用这个 function 获取模块的实例，同时可以传递一个 context 参数作为工厂方法的参数。其他情况则直接把加载到的模块返回。

```javascript
module.exports = (context) => {
  // return some module instance
  return {}
}
```

## 安装

```bash
npm install @olemop/loader
```

## 用法

``` javascript
const Loader = require('@olemop/loader')

const res = Loader.load('.')

console.log('res: %j', res)
```

模块定义成函数，加载

## API

### Loader.load(path, context)

加载 path 目录下所有模块。如果模本身是一个 function，则把这个 function 作为获取模块的工厂方法，通过调用这个方法获取到模块实例，否则直接返回加载到的模块。

#### 参数

- path 加载的目录
- context 如果通过工厂方法加载模块，会将该参数作为初始化参数传给工厂方法。
