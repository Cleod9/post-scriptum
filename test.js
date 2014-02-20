//Runs a simple promise test case
var EP = require('./index.js');

/* Runs a simple promise test case */
	
//A basic asynchronous function that takes a data object and a callback
var asyncFn = function (data, callback1, callback2) {
	console.log('running async function...', data);
	//Simulate an async call
	setTimeout(function () { 
		if(data.id == 1 && Math.random() > 0.5)
			callback2(data); //<- 50% chance of entering this second callback, this is to demonstrate potentially having multiple callbacks
		else
			callback1(data);
	}, 1500);
};

//Run asyncFn with the the remaining arguments as parameters
EP.create(asyncFn, [{ id: 1 }], function (data) {
	console.log('inside the first function callback', data);
	//Demonstrates how proceed will pass data along as params to the next async call
	this.proceed([{ id: 2 }]);
}, function(err) {
	console.log('inside of the error callback');
	this.proceed([{ id: 2 }]);
}).before(function() {
	console.log('inside before() of the first callback');
}).then(asyncFn, function(data) {
	console.log('inside the second function callback', data);
	this.proceed([{ id: 3 }]);
}).after(function() {
	console.log('inside after() of the first callback');
}).then(asyncFn, function(data) {
	console.log('inside the third function callback', data);
	this.proceed();
}).after(function () {
	console.log("Last function");
}).run();