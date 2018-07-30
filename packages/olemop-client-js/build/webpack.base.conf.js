const path = require('path')

module.exports = {
  mode: 'production',
  entry: './src/pomelo-jsclient-websocket.js',
  output: {
    path: path.resolve(__dirname, '..', 'dist'),
    filename: 'olemopclient.js'
  },
  optimization: {
		minimize: false
	}
}
