const path = require('path')
const blanket = require('blanket')

const srcDir = path.join(__dirname, '..', 'lib')

blanket({ pattern: srcDir })
