var Client = require('mysql').Client
var client = new Client()

client.host = 'www.example.com'
client.user = 'xy'
client.password = 'dev'
client.database = 'olemopdb'

exports.client = client
