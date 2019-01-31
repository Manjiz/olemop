const path = require('path')
const webpack = require('webpack')

module.exports = {
  mode: 'production',
  entry: './src/pomelo-jsclient.js',
  output: {
    path: path.resolve(__dirname, '..', 'dist'),
    filename: 'olemopclient.wechat.js'
  },
  optimization: {
		minimize: false
  },
  plugins: [
    new webpack.DefinePlugin({
      __PLATFORM__: '"wechat"'
    })
  ]
}
