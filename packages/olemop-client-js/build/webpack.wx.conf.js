const path = require('path')

module.exports = {
  mode: 'production',
  entry: './src/pomelo-wx-websocket.js',
  output: {
    library: 'pomelo',
    libraryTarget: 'umd',
    path: path.resolve(__dirname, '..', 'dist'),
    filename: 'olemopclient.js'
  },
  optimization: {
		minimize: false
	}
}
