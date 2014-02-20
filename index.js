var fs = require('fs');

eval(fs.readFileSync(__dirname + '/lib/easypromise.js').toString());

module.exports = EasyPromise;