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
	this.options = {
		asyncContext: null, //Reference to context of the asynchronous call (will default to the EasyPromise object)
		callbackContext: null //Reference to context for the callbacks (will default to the EasyPromise object)
	}
	this.children = {}; //Reference to the next promises stored here
	this.prependArgs = [];//List of arguments that will be prepended to callbacks go here
	
	if (args.length <= 0)
		throw new Error('Error, promise needs initial function as the first arg.');
	
	//The actual function we want to run is the first arg
	this.fn = args.shift();
	
	if (args.length <= 0)
		throw new Error('Error, promise expects at least 1 other argument (i.e. args/callback(s))');
		
	//Queue up rest of  arguments
	if (typeof args[0] !== 'function') {
		if(typeof args[0].length === 'undefined')
			throw new Error('Error, second argument of promise must be either an array of args, or a callback function.');
		this.arguments = args[0].slice(0);
		args.splice(0, 1);
	} else {
		this.arguments = [];
	}
	
	if (args.length <= 0)
		throw new Error('Error, promise missing a callback function.');
	
	//Assume the last remaining args are callbacks
	this.callbacks = args.slice(0);
	//Check the first one, we'll let the rest throw an error if there is a problem
	if (typeof this.callbacks[0] !== 'function')
		throw new Error('Error, promise expects the callback arguments to be of type "function"');
};

//Instance variables

EasyPromise.prototype.parent = null; //Reference to a preceding promise
EasyPromise.prototype.children = null; //Reference to a child promises
EasyPromise.prototype.fn = null; //Async func
EasyPromise.prototype.beforeFn = null; //Func to run before async func is executed
EasyPromise.prototype.afterFn = null; //Func to run after callback is returned
EasyPromise.prototype.errorFn = null; //Func to run after an exception is thrown
EasyPromise.prototype.arguments = null; //List of arguments for the async func
EasyPromise.prototype.callbacks = null; //Callback func array
EasyPromise.prototype.prependArgs = null; //List of arguments to prepend to the callbacks
EasyPromise.prototype.options = null; //Options obj

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
	var startExecution = function () {
		//If a 'before' function is set, run it before executing
		if (self.beforeFn) {
			self.beforeFn.call(self);
		}
		//Function to make a wrapper for the original callbacks so that EasyPromise can call the next callback manually
		var callbackArr = [];
		var makeWrapper = function (callback) {
			return function () {
				var args = Array.prototype.slice.call(arguments);
				//Run the original callback in specified context
				callback.apply(self.options.callbackContext || self, args);
				//If an 'after' function is set, run it after the callback is run
				if (self.afterFn) {
					self.afterFn.call(self);
				}
			};
		};
		//For each callback, create a new wrapper
		for (var i = 0; i < self.callbacks.length; i++) {
			callbackArr.push(makeWrapper(self.callbacks[i]));
		}
		
		//Execute the asynchronous function by combining the arguments list with the callback list
		self.fn.apply(self.options.asyncContext || self, self.arguments.concat(callbackArr));
	};
	//If error function is set, use try-catch
	if (self.errorFn) {
		try {
			startExecution();
		} catch (e) {
			self.errorFn(e);
		}
	} else {
		startExecution();
	}
};
EasyPromise.prototype.config = function (options) {
	//Modifies the options variable
	for (var i in options) {
		this.options[i] = options[i];
	}
	return this;
};
EasyPromise.prototype.abind = function (context) {
	//Bind context for asynchronous function
	this.options.asyncContext = context;
	
	return this;
};
EasyPromise.prototype.cbind = function (context) {
	//Bind context for the callback
	this.options.callbackContext = context;
	
	return this;
};
EasyPromise.prototype.proceed = function (fnArgs) {
	//Proceed to the next child promise
	EasyPromise.prototype.proceedTo.call(this, 'default', fnArgs);
};
EasyPromise.prototype.proceedTo = function (name, fnArgs) {
	//Execute the next callback (if it exists)
	if(this.children[name]) {
		this.children[name].arguments = this.children[name].arguments.concat(fnArgs);
		this.children[name].execute.call(this.children[name]);
	}
};
EasyPromise.prototype.proceedWith = function (callbackPrependArgs, fnArgs) {
	//Prepends custom args to the callback functions
	this.prependArgs = callbackPrependArgs
	this.proceed(fnArgs);
};
EasyPromise.prototype.proceedToWith = function (name, callbackPrependArgs, fnArgs) {
	//Prepends custom args to the callback functions for the specified child promise name
	this.prependArgs = callbackPrependArgs
	this.proceedTo(name, fnArgs);
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
EasyPromise.prototype.catch = function (fn) {
	//Handle errors for all promises. At this point only run() will be exposed
	
	var self = this;
	var actions = { 
		run: function () {
			try {
				self.run();
			} catch (err) {
				fn(err);
			}
		}
	};
	
	return actions;
};


//Static functions
EasyPromise.create = function () {
	//Starts chaining a promise. (The first promise will have a null parent)
	var args = Array.prototype.slice.call(arguments);
	var promise = new EasyPromise(args);
	return promise;
}