备忘：ws 和 wss 的区别在于 Protocol.strdecode，详看该段的内部注释

```javascript
return String.fromCharCode.apply(null, array)
// -===== for ws: DIFF by @olemop/core template build.js/build.js.wss，除协议符，两者就这里不同，实际上，上面就够了 =====-
// let res = ''
// const chunk = 8 * 1024
// for (let i = 0; i < array.length / chunk; i++) {
//   res += String.fromCharCode.apply(null, array.slice(i * chunk, (i + 1) * chunk))
// }
// res += String.fromCharCode.apply(null, array.slice(i * chunk))
// return res
```
