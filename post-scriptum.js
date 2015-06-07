/*******************************
  post-scriptum.js Version 0.3.1
  
    A simple promise-like library for flattening callbacks.
  
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

(function (context) {
  //Constructor
  function PostScriptum (args) {
    this.status = PostScriptum.STATUS_CODES.IDLE;
    
    var fullArgs = null;
    var tmpArgs = Array.prototype.slice.call(arguments);
    if(tmpArgs.length === 1) {
      fullArgs = args; //Assume initialized via create(), we expect to be receiving an array
    } else {
      fullArgs = tmpArgs; //Assume initialized via 'new', we expect to be receiving parameters individually
    }

    this.options = {
      async: false, //If the callback should be forced to asynchronous via setImmediate or setTimeout
      asyncContext: null, //Reference to context of the asynchronous call (will default to the PostScriptum object)
      callbackContext: null, //Reference to context for the callbacks (will default to the PostScriptum object)
      prependArgs: [] //List of arguments to be prepended to this instances's callback functions
    }
    this.children = {}; //Reference to the next instances stored here
    
    if (fullArgs.length <= 0) {
      throw new Error('Error, instance needs initial function as the first arg.');
    }
    
    //The actual function we want to run is the first arg
    this.fn = fullArgs.shift();
    
    if(typeof this.fn !== 'function' && !(this.fn && this.fn._isPostScriptum)) {
      throw new Error('Error, expecting a function or PostScriptum instance as the first argument of the PostScriptum constructor');
    }
      
    if (fullArgs.length <= 0) {
      throw new Error('Error, PostScriptum constructor expects at least 1 other argument (i.e. args/callback(s))');
    }
      
    //Queue up rest of  arguments
    if (typeof fullArgs[0] !== 'function') {
      if(typeof fullArgs[0].length === 'undefined') {
        throw new Error('Error, second argument of PostScriptum constructor must be either an array of args, or a callback function.');
      }
      this.arguments = fullArgs[0].slice(0);
      fullArgs.splice(0, 1);
    } else {
      this.arguments = [];
    }
    
    if (fullArgs.length <= 0) {
      throw new Error('Error, PostScriptum constructor missing a callback function.');
    }
    
    //Assume the last remaining args are callbacks
    this.callbacks = fullArgs.slice(0);
    //Check the first one, we'll let the rest throw an error if there is a problem
    if (typeof this.callbacks[0] !== 'function') {
      throw new Error('Error, PostScriptum constructor expects the callback arguments to be of type "function"');
    }
  };

  //Static vars
  PostScriptum.STATUS_CODES = { IDLE: 0, PENDING: 1, SUCCESS: 2, FAILURE: 3, CLOSED: 4 };
  PostScriptum.BENCHMARK = false; //Enables benchmarking

  //Instance variables
  PostScriptum.prototype._parent = null; //Reference to a preceding PostScriptum instance
  PostScriptum.prototype.children = null; //Reference to the child PostScriptum instances
  PostScriptum.prototype.fn = null; //An asynchronous function that has a one or more trailing callback arguments
  PostScriptum.prototype.beforeFn = null; //Func to run before async func is executed
  PostScriptum.prototype.afterFn = null; //Func to run after callback is returned
  PostScriptum.prototype.errorFn = null; //Func to run after an exception is thrown
  PostScriptum.prototype.catchFn = null; //Func to run after an exception is thrown (for full tree)
  PostScriptum.prototype.finishFn = null; //Func to run after a PostScriptum chain finishes
  PostScriptum.prototype.arguments = null; //List of arguments for the async func
  PostScriptum.prototype.callbacks = null; //Callback func array
  PostScriptum.prototype.options = null; //Options obj
  PostScriptum.prototype.status = 0; //Current status of the PostScriptum object (0 = Idle, 1 = Pending, 2 = Success, 3 = Failure, 4 = Closed)
  PostScriptum.prototype._finalArgs = null; //Temporary container for callback arguments to make it easier to do PostScriptum-PostScriptum chains
  PostScriptum.prototype._hasError = false; //Contains error status for closed PostScriptum instances
  PostScriptum.prototype._isNested = false; //Flag to indicate that this PostScriptum instance is nested within another PostScriptum instance
  PostScriptum.prototype._catchFlag = false; //Flag for try-catch mode
  PostScriptum.prototype._isPostScriptum = true; //For type checking without instanceof
  PostScriptum.prototype._afterFinishFn = null; //Func to run after a PostScriptum chain finishes (private, internal use only)
  PostScriptum.prototype._disposed = false; //Remember if this PostScriptum node was disposed or not
  PostScriptum.prototype._time = 0; //Used for benchmarking

  //Instance functions

  PostScriptum.prototype.run = function () {
    if (this._parent) {
      //Find the top level PostScriptum instance
      this._parent.run();
    } else {
      if (PostScriptum.BENCHMARK) {
        this._time = new Date().getTime();
      }
      //Execute
      this.execute();
    }
  };
  PostScriptum.prototype.execute = function () {
    //Executes the asynchronous function
    var self = this;
    var rootPromise = self.getRoot();
    self.status = PostScriptum.STATUS_CODES.PENDING;

    //Wrap the bulk in a function call so we can control when it starts
    var startExecution = function () {
      //Benchmarking
      if (PostScriptum.BENCHMARK) {
        self._time = new Date().getTime();
      }
      //If a 'before' function is set, run it before executing
      if (self.beforeFn) {
        self.beforeFn(self);
      }
      //Function to make a wrapper for the original callbacks so that PostScriptum can call the next callback manually
      var callbackArr = [];
      var makeWrapper = function (callback) {
        return function () {
          //Grab arguments for this function call and prepend the extra callback args
          var args = self.options.prependArgs.concat(Array.prototype.slice.call(arguments));
          
          //Grant success code
          self.status = PostScriptum.STATUS_CODES.SUCCESS;
          
          //Run the callback in specified context
          callback.apply(self.options.callbackContext || self, args);
          
          //If an 'after' function is set, run it after the callback is run
          if (self.afterFn) {
            self.afterFn(self);
          }
          
          //If this PostScriptum instance is marked as closed, run the root PostScriptum instance's finish function
          if (self.status === PostScriptum.STATUS_CODES.CLOSED) {
            if(rootPromise.finishFn) {
              rootPromise.finishFn.call(self);
            }
            if(rootPromise._afterfinishFn) {
              rootPromise._afterfinishFn.call(self);
            }
            if (PostScriptum.BENCHMARK) {
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
      
       //For _isNested flagged PostScriptum instances, replace function with its returned PostScriptum instance
      if(self._isNested) {
        self.fn = self.fn.apply(self.options.asyncContext || self, self.arguments);
      }
      
      if (self.fn && self.fn._isPostScriptum) {
        //The function is of type PostScriptum, so we will run it like a PostScriptum instance
        self.fn.getRoot()._afterfinishFn = function() {
          //When complete, run the callback for the containing PostScriptum instance using the arguments from the inner PostScriptum instance's callback
          var fnIndex = (this._hasError) ? 1 : 0;
          if (fnIndex < callbackArr.length) {
            callbackArr[fnIndex].apply(this, this._finalArgs); //At this point, inner PostScriptum instances have completed
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
          self.status = PostScriptum.STATUS_CODES.FAILURE;
          if(self.errorFn) {
            self.errorFn(e);
          } else {
            rootPromise.catchFn(e);
          }
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
          self.status = PostScriptum.STATUS_CODES.FAILURE;
          if(self.errorFn) {
            self.errorFn(e);
          } else {
            rootPromise.catchFn(e);
          }
        }
      } else {
        startExecution();
      }
    }
  };
  PostScriptum.prototype.config = function (options) {
    //Modifies the options variable
    for (var i in options) {
      this.options[i] = options[i];
    }
    return this;
  };
  PostScriptum.prototype.async = function () {
    //Shortcut to set async: true in config
    this.config({ async: true });
    return this;
  };
  PostScriptum.prototype.abind = function (context) {
    //Bind context for asynchronous function
    this.options.asyncContext = context;
    
    return this;
  };
  PostScriptum.prototype.cbind = function (context) {
    //Bind context for the callback
    this.options.callbackContext = context;
    
    return this;
  };
  PostScriptum.prototype.prepend = function (callbackPrependArgs) {
    //Prepends custom args to the this PostScriptum instance's callbacks
    this.options.prependArgs = callbackPrependArgs;

    return this;
  };
  PostScriptum.prototype.proceed = function (fnArgs) {
    //Proceed to the next child PostScriptum instance
    PostScriptum.prototype.proceedTo.call(this, 'default', fnArgs || []);
  };
  PostScriptum.prototype.proceedTo = function (name, fnArgs) {
    //Execute the next callback (if it exists)
    if(this.children[name]) {
      this.children[name].arguments = this.children[name].arguments.concat(fnArgs || []);
      this.children[name].execute.call(this.children[name]);
    }
  };
  PostScriptum.prototype.proceedWith = function (callbackPrependArgs, fnArgs) {
    //Prepends custom args to the child's callback functions
    this.children['default'].prepend(callbackPrependArgs);
    this.proceed(fnArgs);
  };
  PostScriptum.prototype.proceedToWith = function (name, callbackPrependArgs, fnArgs) {
    //Prepends custom args to the child's callback functions for the specified child PostScriptum instance name
    this.children[name].prepend(callbackPrependArgs);
    this.proceedTo(name, fnArgs);
  };
  PostScriptum.prototype.define = function () {
    //Defines a child PostScriptum instance for this current instance
    var args = Array.prototype.slice.call(arguments);
    var name = args.shift();
    var instance = new PostScriptum(args);
    instance._parent = this;
    this.children[name] = instance;
    return instance;
  };
  PostScriptum.prototype.parent = function () {
    //Return the parent PostScriptum instance
    return this._parent;
  };
  PostScriptum.prototype.child = function (name) {
    //Return a child PostScriptum instance specified by name
    return this.children[name] || null;
  };
  PostScriptum.prototype.pdefine = function () {
    //Defines a PostScriptum instance that returns another PostScriptum instance
    var args = Array.prototype.slice.call(arguments);
    var instance = this.define.apply(this, args);
    instance._isNested = true;
    return instance;
  };
  PostScriptum.prototype.then = function () {
    //Chain the next PostScriptum instance
    var args = Array.prototype.slice.call(arguments);
    args.unshift('default');
    PostScriptum.prototype.define.apply(this, args);
    return this.children['default'];
  };
  PostScriptum.prototype.pthen = function () {
    //Chain the next PostScriptum-returning PostScriptum instance
    var args = Array.prototype.slice.call(arguments);
    var instance = this.then.apply(this, args);
    instance._isNested = true;
    return instance;
  };
  PostScriptum.prototype.after = function (fn) {
    //Occurs after a callback is run but before the next PostScriptum instance
    this.afterFn = fn;
    
    return this;
  };
  PostScriptum.prototype.before = function (fn) {
    //Occurs before the asynchronous function is run
    this.beforeFn = fn;
    
    return this;
  };
  PostScriptum.prototype.resolve = function () {
    //For Q-styled chaining, calls the success callback
    var args = Array.prototype.slice.call(arguments);
    this._finalArgs = args;
    this._hasError = false;
    this.status = PostScriptum.STATUS_CODES.CLOSED;
  };
  PostScriptum.prototype.reject = function () {
    //For Q-styled chaining, calls the error callback
    var args = Array.prototype.slice.call(arguments);
    this._finalArgs = args;
    this._hasError = true;
    this.status = PostScriptum.STATUS_CODES.CLOSED;
  };
  PostScriptum.prototype.getRoot = function () {
    //Find the root PostScriptum instance
    if(!this._parent) {
      return this;
    } else {
      return this._parent.getRoot();
    }
  };
  PostScriptum.prototype.finish = function (fn) {
    //Attach a function to run when the full PostScriptum chain is finished (attaches to root PostScriptum instance only)
    this.getRoot().finishFn = fn; //Function to run when a PostScriptum chain finishes
    return this;
  };
  PostScriptum.prototype.error = function (fn) {
    //Handle errors for a particular PostScriptum instance
    this.errorFn = fn;
    
    return this;
  };
  PostScriptum.prototype.catch = function (fn) {
    //Handle errors for all PostScriptum instances. At this point only run() will be exposed, so this should be used last.
    this.getRoot()._catchFlag = true;
    this.getRoot().catchFn = fn;
    
    return this;
  };

  //Cleanup the PostScriptum chain
  PostScriptum.prototype.dispose = function () {
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
  PostScriptum.create = function () {
    //Creates an empty PostScriptum instance (Same as calling new PostScriptum())
    var args = Array.prototype.slice.call(arguments);

    return new PostScriptum(args);
  };
  PostScriptum.pcreate = function () {
    //Creates an empty PostScriptum instance that is designed to return another instance.
    var args = Array.prototype.slice.call(arguments);
    if(args.length > 0 && args[0] && args[0]._isPostScriptum) {
      throw new Error("Error, PostScriptum.pcreate() does not accept a PostScriptum instance directly. Please supply a function instead, or try using PostScriptum.create()");
    }
    var instance = PostScriptum.create.apply(PostScriptum, args);
    instance._isNested = true;
    
    return instance;
  };

  //Support for Node.js and browser
  if (typeof module !== 'undefined' && typeof exports !== 'undefined' && module.exports) {
    exports = module.exports = PostScriptum;
  } else {
    context.PS = PostScriptum;
  }
}).call(this);