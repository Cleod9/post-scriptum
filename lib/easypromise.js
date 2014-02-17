/*******************************
	EasyPromise Version 0.1
	
    A truly simple promise library for avoiding asynchronous callback spaghetti.
	
  	The MIT License (MIT)

	Copyright (c) 2013 Greg McLeod <cleod9{at}gmail.com>

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in
	all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	THE SOFTWARE.
*******************************/

//Constructor
function EasyPromise (args) {
	this.parent = null; //Reference to a preceding promise
	this.children = {}; //Reference to the next promises
	
	if (args.length <= 0)
		throw new Error('Error, promise needs initial function as the first arg.');
	this.fn = args.shift(); //The actual function we want to run
	
	if (args.length <= 0)
		throw new Error('Error, promise expects at least expects 1 other argument (i.e. callback)');
	//Queue up all arguments
	if (args.length > 1) {
		this.arguments = args.slice(0, args.length - 1);
		args.splice(0, args.length - 1);
	} else {
		this.arguments = [];
	}
	
	//Assume the last remaining function as the callback
	this.callback = args.shift(); //The final arg will be the callback
	if (typeof this.callback !== 'function')
		throw new Error('Error, promise expects the callback argument to be of type "function"');
};

//Instance variables
EasyPromise.prototype.parent = null;
EasyPromise.prototype.fn = null;
EasyPromise.prototype.beforeFn = null;
EasyPromise.prototype.afterFn = null;
EasyPromise.prototype.errorFn = null;
EasyPromise.prototype.arguments = null;
EasyPromise.prototype.callback = null;
EasyPromise.prototype.error = null;

//Instance functions
EasyPromise.prototype.run = function () {
	if (this.parent) {
		//Find the top level promise
		this.parent.run();
	} else {
		//Execute
		this.execute();
	}
};
EasyPromise.prototype.execute = function () {
	//Execute the asynchronous function
	var self = this;
	try {
		//If a 'before' function is set, run it before executing
		if (self.beforeFn) {
			self.beforeFn.call(this);
		}
		//Wraps the original callback in a method where we can call the next callback ourselves
		self.fn.apply(self, self.arguments.concat([ function () {
			var args = Array.prototype.slice.call(arguments);
			//Run the original callback
			self.callback.apply(self, args);
			//If an 'after' function is set, run it after the callback is run
			if (self.afterFn) {
				self.afterFn.call(this);
			}
		}]));
	} catch (e) {
		if (this.errorFn) {
			this.errorFn(e);
		}
	}
};
EasyPromise.prototype.proceed = function () {
	var args = Array.prototype.slice.call(arguments);
	args.unshift('default');
	EasyPromise.prototype.proceedTo.apply(this, args);
};
EasyPromise.prototype.proceedTo = function () {
	var args = Array.prototype.slice.call(arguments);
	var name = args.shift();
	//Execute the next callback (if it exists)
	if(this.children[name]) {
		this.children[name].arguments = this.children[name].arguments.concat(args);
		this.children[name].execute.call(this.children[name]);
	}
};
EasyPromise.prototype.define = function () {
	//Defines a child promise for this current promise
	var args = Array.prototype.slice.call(arguments);
	var name = args.shift();
	var promise = new EasyPromise(args);
	promise.parent = this;
	this.children[name] = promise;
	return this;
};
EasyPromise.prototype.then = function () {
	var args = Array.prototype.slice.call(arguments);
	args.unshift('default');
	EasyPromise.prototype.define.apply(this, args);
	return this.children['default'];
};
EasyPromise.prototype.after = function (fn) {
	//Occurs after a callback is run but before the next promise
	this.afterFn = fn;
	
	return this;
};
EasyPromise.prototype.before = function (fn) {
	//Occurs before the asynchronous function is run
	this.beforeFn = fn;
	
	return this;
};
EasyPromise.prototype.error = function (fn) {
	//Handle errors for a particular promise
	this.errorFn = fn;
	
	return this;
};

//Static functions
EasyPromise.begin = function () {
	//Starts chaining a promise. (The first promise will have a null parent)
	var args = Array.prototype.slice.call(arguments);
	var promise = new EasyPromise(args);
	return promise;
}

//Runs a simple promise test case
EasyPromise.test = function () {
	//A basic asynchronous function that takes a data object and a callback
	var asyncFn = function (data, callback) {
		console.log('running async function...', data);
		//Simulate an async call
		setTimeout(function () { 
			callback(data);
		}, 1500);
	};

	//Run asyncFn with the the remaining arguments as parameters
	EasyPromise.begin(asyncFn, { id: 1 }, function (data) {
		console.log('inside the first function callback', data);
		//Demonstrates how proceed will pass data along as params to the next async call
		this.proceed({ id: 2 });
	}).before(function() {
		console.log('inside before() of the first callback');
	}).then(asyncFn, function(data) {
		console.log('inside the second function callback', data);
		this.proceed({ id: 3 });
	}).after(function() {
		console.log('inside after() of the first callback');
	}).then(asyncFn, function(data) {
		console.log('inside the third function callback', data);
		this.proceed();
	}).after(function () {
		console.log("Last function");
	}).run();
};