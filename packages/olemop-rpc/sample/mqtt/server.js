var net = require('net'),
	mqttCon = require('mqtt-connection'),
	server = new net.Server();
var num = 300;
var len = num * num;
var i = 1;

var start = 0;
server.on('connection', (stream) => {
	var conn = mqttCon(stream);

	conn.on('connect', () => {
		console.log('connected');
	});

	conn.on('publish', (packet) => {
		// console.log(packet);
		conn.puback({
			messageId: packet.messageId
		})
	});

	conn.on('pingreq', () => {
		conn.pingresp();
	});
	// conn is your MQTT connection!
});

server.listen(1883)
console.log('server started.');
