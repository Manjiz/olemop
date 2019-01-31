const webpack = require('webpack')
const merge = require('webpack-merge')
const baseConf = require('./webpack.base.conf')

module.exports = merge(baseConf, {
  output: {
    filename: 'olemopclient.wechat.js'
  },
  plugins: [
    new webpack.DefinePlugin({
      __PLATFORM__: '"wechat"'
    })
  ]
})
