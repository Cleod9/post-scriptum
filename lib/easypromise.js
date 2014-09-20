/*******************************
  EasyPromise Version 0.2.1
  
    A truly simple promise library for avoiding asynchronous callback spaghetti.
  
    The MIT License (MIT)

  Copyright (c) 2014 Greg McLeod <cleod9{at}gmail.com>

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

(function () {
  //Constructor
  function EasyPromise (args) {
    this.status = EasyPromise.STATUS_CODES.IDLE;
    
    var fullArgs = null;
    var tmpArgs = Array.prototype.slice.call(arguments);
    if(tmpArgs.length === 1)
      fullArgs = args; //Assume initialized via create(), we expect to be receiving an array
    else
      fullArgs = tmpArgs; //Assume initialized via 'new', we expect to be receiving parameters individually

    this.options = {
      async: false, //If the callback should be forced to asynchronous via setImmediate or setTimeout
      asyncContext: null, //Reference to context of the asynchronous call (will default to the EasyPromise object)
      callbackContext: null, //Reference to context for the callbacks (will default to the EasyPromise object)
      prependArgs: [] //List of arguments to be prepended to this promise's callback functions
    }
    this.children = {}; //Reference to the next promises stored here
    
    if (fullArgs.length <= 0)
      throw new Error('Error, promise needs initial function as the first arg.');
    
    //The actual function we want to run is the first arg
    this.fn = fullArgs.shift();
    
    if(typeof this.fn !== 'function' && !(this.fn && this.fn._isEasyPromise))
      throw new Error('Error, expecting a function or promise as the first argument of the promise constructor');
      
    if (fullArgs.length <= 0)
      throw new Error('Error, promise expects at least 1 other argument (i.e. args/callback(s))');
      
    //Queue up rest of  arguments
    if (typeof fullArgs[0] !== 'function') {
      if(typeof fullArgs[0].length === 'undefined')
        throw new Error('Error, second argument of promise must be either an array of args, or a callback function.');
      this.arguments = fullArgs[0].slice(0);
      fullArgs.splice(0, 1);
    } else {
      this.arguments = [];
    }
    
    if (fullArgs.length <= 0)
      throw new Error('Error, promise missing a callback function.');
    
    //Assume the last remaining args are callbacks
    this.callbacks = fullArgs.slice(0);
    //Check the first one, we'll let the rest throw an error if there is a problem
    if (typeof this.callbacks[0] !== 'function')
      throw new Error('Error, promise expects the callback arguments to be of type "function"');
  };

  //Static vars
  EasyPromise.STATUS_CODES = { IDLE: 0, PENDING: 1, SUCCESS: 2, FAILURE: 3, CLOSED: 4 };
  EasyPromise.BENCHMARK = false; //Enables benchmarking

  //Instance variables
  EasyPromise.prototype._parent = null; //Reference to a preceding promise
  EasyPromise.prototype.children = null; //Reference to a child promises
  EasyPromise.prototype.fn = null; //Async func
  EasyPromise.prototype.beforeFn = null; //Func to run before async func is executed
  EasyPromise.prototype.afterFn = null; //Func to run after callback is returned
  EasyPromise.prototype.errorFn = null; //Func to run after an exception is thrown
  EasyPromise.prototype.catchFn = null; //Func to run after an exception is thrown (for full tree)
  EasyPromise.prototype.finishFn = null; //Func to run after a promise chain finishes
  EasyPromise.prototype.arguments = null; //List of arguments for the async func
  EasyPromise.prototype.callbacks = null; //Callback func array
  EasyPromise.prototype.options = null; //Options obj
  EasyPromise.prototype.status = 0; //Current status of the promise object (0 = Idle, 1 = Pending, 2 = Success, 3 = Failure, 4 = Closed)
  EasyPromise.prototype._finalArgs = null; //Temporary container for callback arguments to make it easier to do promise-promise chains
  EasyPromise.prototype._hasError = false; //Tracks error status for closed promise
  EasyPromise.prototype._pFlag = false; //Flag to indicate that this promise is nested within another promise
  EasyPromise.prototype._catchFlag = false; //Flag for try-catch mode
  EasyPromise.prototype._isEasyPromise = true; //For type checking without instanceof
  EasyPromise.prototype._afterFinishFn = null; //Func to run after a promise chain finishes (private, internal use only)
  EasyPromise.prototype._disposed = false; //Remember if this promise node was disposed or not
  EasyPromise.prototype._time = 0; //Used for benchmarking

  //Instance functions

  EasyPromise.prototype.run = function () {
    if (this._parent) {
      //Find the top level promise
      this._parent.run();
    } else {
      if (EasyPromise.BENCHMARK) {
        this._time = new Date().getTime();
      }
      //Execute
      this.execute();
    }
  };
  EasyPromise.prototype.execute = function () {
    //Execute the asynchronous function
    var self = this;
    var rootPromise = self.getRoot();
    self.status = EasyPromise.STATUS_CODES.PENDING;
    var startExecution = function () {
      //Benchmarking
      if (EasyPromise.BENCHMARK) {
        self._time = new Date().getTime();
      }
      //If a 'before' function is set, run it before executing
      if (self.beforeFn) {
        self.beforeFn(self);
      }
      //Function to make a wrapper for the original callbacks so that EasyPromise can call the next callback manually
      var callbackArr = [];
      var makeWrapper = function (callback) {
        return function () {
          //Grab arguments for this function call and prepend the extra callback args
          var args = self.options.prependArgs.concat(Array.prototype.slice.call(arguments));
          
          //Grant success code
          self.status = EasyPromise.STATUS_CODES.SUCCESS;
          
          //Run the callback in specified context
          callback.apply(self.options.callbackContext || self, args);
          
          //If an 'after' function is set, run it after the callback is run
          if (self.afterFn) {
            self.afterFn(self);
          }
          
          //If this promise is marked as closed, run the root promise's finish function
          if (self.status === EasyPromise.STATUS_CODES.CLOSED) {
            if(rootPromise.finishFn) {
              rootPromise.finishFn.call(self);
            }
            if(rootPromise._afterfinishFn) {
              rootPromise._afterfinishFn.call(self);
            }
            if (EasyPromise.BENCHMARK) {
              var finishTime = (new Date().getTime()) - self.getRoot()._time;
              console.log(self.getRoot().arguments, finishTime + " ms");
            }
            self.dispose();
          }
        };
      };
      
      //For each callback, create a new wrapper
      for (var i = 0; i < self.callbacks.length; i++) {
        callbackArr.push(makeWrapper(self.callbacks[i]));
      }
      
       //For pflag'd promises, replace function with its returned promise
      if(self._pFlag)
        self.fn = self.fn.apply(self.options.asyncContext || self, self.arguments);
      
      if (self.fn && self.fn._isEasyPromise) {
        //The function is of type EasyPromise, so we will run it like a promise
        self.fn.getRoot()._afterfinishFn = function() {
          //When complete, run the callback for the containing promise using the arguments from the inner promise's callback
          var fnIndex = (this._hasError) ? 1 : 0;
          if (fnIndex < callbackArr.length) {
            callbackArr[fnIndex].apply(this, this._finalArgs); //At this point, inner promises have completed
          }
        };
        self.fn.run();
      } else {
        //Execute the asynchronous function by combining the arguments list with the callback list
        self.fn.apply(self.options.asyncContext || self, self.arguments.concat(callbackArr));
      }
    };
    var wrapExecution = function () {
     //If error function is set, use try-catch
      if (self.errorFn || rootPromise.catchFn) {
        try {
         startExecution();
        } catch (e) {
          self.status = EasyPromise.STATUS_CODES.FAILURE;
          if(self.errorFn)
            self.errorFn(e);
          else
            rootPromise.catchFn(e);
        }
      } else {
        startExecution();
      }
    };
    if (self.options.async) {
      if (typeof setImmediate !== 'undefined') {
        setImmediate(wrapExecution);
      } else {
        setTimeout(wrapExecution, 0);
      }
    } else {
     //If error function is set, use try-catch
      if (self.errorFn || rootPromise.catchFn) {
        try {
         startExecution();
        } catch (e) {
          self.status = EasyPromise.STATUS_CODES.FAILURE;
          if(self.errorFn)
            self.errorFn(e);
          else
            rootPromise.catchFn(e);
        }
      } else {
        startExecution();
      }
    }
  };
  EasyPromise.prototype.config = function (options) {
    //Modifies the options variable
    for (var i in options) {
      this.options[i] = options[i];
    }
    return this;
  };
  EasyPromise.prototype.async = function () {
    //Shortcut to set async: true in config
    this.config({ async: true });
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
  EasyPromise.prototype.prepend = function (callbackPrependArgs) {
    //Prepends custom args to the this promise's callbacks
    this.options.prependArgs = callbackPrependArgs;

    return this;
  };
  EasyPromise.prototype.proceed = function (fnArgs) {
    //Proceed to the next child promise
    EasyPromise.prototype.proceedTo.call(this, 'default', fnArgs || []);
  };
  EasyPromise.prototype.proceedTo = function (name, fnArgs) {
    //Execute the next callback (if it exists)
    if(this.children[name]) {
      this.children[name].arguments = this.children[name].arguments.concat(fnArgs || []);
      this.children[name].execute.call(this.children[name]);
    }
  };
  EasyPromise.prototype.proceedWith = function (callbackPrependArgs, fnArgs) {
    //Prepends custom args to the child's callback functions
    this.children['default'].prepend(callbackPrependArgs);
    this.proceed(fnArgs);
  };
  EasyPromise.prototype.proceedToWith = function (name, callbackPrependArgs, fnArgs) {
    //Prepends custom args to the child's callback functions for the specified child promise name
    this.children[name].prepend(callbackPrependArgs);
    this.proceedTo(name, fnArgs);
  };
  EasyPromise.prototype.define = function () {
    //Defines a child promise for this current promise
    var args = Array.prototype.slice.call(arguments);
    var name = args.shift();
    var promise = new EasyPromise(args);
    promise._parent = this;
    this.children[name] = promise;
    return promise;
  };
  EasyPromise.prototype.parent = function () {
    //Return the parent promise
    return this._parent;
  };
  EasyPromise.prototype.child = function (name) {
    //Return a child promise specified by name
    return this.children[name] || null;
  };
  EasyPromise.prototype.pdefine = function () {
    //Defines a promise that runs another promise (Q-style)
    var args = Array.prototype.slice.call(arguments);
    var promise = this.define.apply(this, args);
    promise._pFlag = true;
    return promise;
  };
  EasyPromise.prototype.then = function () {
    //Chain the next promise
    var args = Array.prototype.slice.call(arguments);
    args.unshift('default');
    EasyPromise.prototype.define.apply(this, args);
    return this.children['default'];
  };
  EasyPromise.prototype.pthen = function () {
    //Chain the next promise (identified as a promise function)
    var args = Array.prototype.slice.call(arguments);
    var promise = this.then.apply(this, args);
    promise._pFlag = true;
    return promise;
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
  EasyPromise.prototype.resolve = function () {
    //For Q-styled chaining, calls the success callback
    var args = Array.prototype.slice.call(arguments);
    this._finalArgs = args;
    this._hasError = false;
    this.status = EasyPromise.STATUS_CODES.CLOSED;
  };
  EasyPromise.prototype.reject = function () {
    //For Q-styled chaining, calls the error callback
    var args = Array.prototype.slice.call(arguments);
    this._finalArgs = args;
    this._hasError = true;
    this.status = EasyPromise.STATUS_CODES.CLOSED;
  };
  EasyPromise.prototype.getRoot = function () {
    //Find the root promise
    if(!this._parent)
      return this;
    else
      return this._parent.getRoot();
  };
  EasyPromise.prototype.finish = function (fn) {
    //Attach a function to run when the full promise chain is finished (attaches to root promise only)
    this.getRoot().finishFn = fn; //Function to run when a promise chain finishes
    return this;
  };
  EasyPromise.prototype.error = function (fn) {
    //Handle errors for a particular promise
    this.errorFn = fn;
    
    return this;
  };
  EasyPromise.prototype.catch = function (fn) {
    //Handle errors for all promises. At this point only run() will be exposed
    this.getRoot()._catchFlag = true;
    this.getRoot().catchFn = fn;
    
    return this;
  };

  //Cleanup the promise chain
  EasyPromise.prototype.dispose = function () {
    if (this._disposed) {
      return;
    }
    this._disposed = true;

    var i, n;
    var disposalList = [];

    //Dispose children
    for (i in this.children) {
      disposalList.push(i);
    }
    while (disposalList.length > 0) {
      this.children[disposalList[0]].dispose();
      this.children[disposalList[0]] = null;
      delete this.children[disposalList[0]];
      disposalList.splice(0, 1);
    }

    //Dispose arguments
    if (this.arguments) {
      while (this.arguments > 0) {
        this.arguments[0] = null;
        this.arguments.splice(0, 1);
      }
    }

    //Dispose final arguments
    if (this._finalArgs) {
      while (this._finalArgs > 0) {
        this._finalArgs[0] = null;
        this._finalArgs.splice(0, 1);
      }
    }

    //Dispose callbacks
    if (this.callbacks) {
      while (this.callbacks > 0) {
        this.callbacks[0] = null;
        this.callbacks.splice(0, 1);
      }
    }

    //Dispose options
    for (i in this.options) {
      disposalList.push(i);
    }
    while (disposalList.length > 0) {
      this.options[disposalList[0]] = null;
      delete this.options[disposalList[0]];
      disposalList.splice(0, 1);
    }

    //Dispose parent
    if (this._parent) {
      this._parent.dispose();
    }

    this._parent = null;
    this.fn = null;
    this.beforeFn = null;
    this.afterFn = null;
    this.errorFn = null;
    this.catchFn = null;
    this.finishFn = null;
    this.children = null;
    this.arguments = null;
    this.callbacks = null;
    this.options = null;
    this._afterFinishFn = null;
    disposalList = null;
  };


  //Static functions
  EasyPromise.create = function () {
    //Starts chaining a promise. (The first promise will have a null parent)
    var args = Array.prototype.slice.call(arguments);
    var promise = new EasyPromise(args);
    return promise;
  };
  EasyPromise.pcreate = function () {
    //Starts chaining a promise. (The first promise will have a null parent)
    var args = Array.prototype.slice.call(arguments);
    if(args.length > 0 && args[0] && args[0]._isEasyPromise)
      throw new Error("Error, EasyPromise.pcreate() does not accept a promise object directly. Please supply a function instead, or try using EasyPromise.create()");
    var promise = EasyPromise.create.apply(EasyPromise, args);
    promise._pFlag = true;
    
    return promise;
  };

  //Support for Node.js and browser
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = EasyPromise;
    }
    exports.EasyPromise = EasyPromise;
  } else {
    this.EasyPromise = EasyPromise;
  }
}).call(this);