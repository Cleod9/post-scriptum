var fs = require('fs');

eval(fs.readFileSync(__dirname + '/lib/easypromise.js').toString());

module.exports = { begin: EasyPromise.begin, test: EasyPromise.test };