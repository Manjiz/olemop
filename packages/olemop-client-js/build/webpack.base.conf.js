const path = require('path')
const webpack = require('webpack')

module.exports = {
  mode: 'production',
  entry: './src/pomelo-jsclient.js',
  output: {
    path: path.resolve(__dirname, '..', 'dist')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      }
    ]
  },
  optimization: {
		minimize: false
  }
}
