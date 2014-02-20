# EasyPromise (Node.js)#

----------

EasyPromise is a promise library I made to be as simple or complex as you need it to be. Unlike other promise libraries (\*cough\*Q\*cough\*), simply understanding how a callback works is more than enough knowledge to be able to use it. The primary purpose of this library is to solve what is known as "callback spaghetti". And by solve, I mean eliminate it altogether. My philosophy here was that a promise library should be able to work with any type of function that has callbacks as trailing parameters, and so long as you are sequentially running asynchronous functions you should never have to nest a callback within a callback. To achieve this, my goals can be outlined as follows:

1. Allow promises to be chained together like other libraries (removes the spaghetti)
2. Avoid having to write custom "promise returning functions" just to use the library
3. Allow the ability initialize the subsequent promise from within a callback
4. Allow extra data to be passed to the next promise from within a callback
5. Allow the ability to traverse down a different promise path depending on the result of a callback

This library attempts to tackle these goals by keeping complexity at a minimum and putting you in the drivers seat of your callback flow.

## Installation ##

```
npm install easypromise
```

And that's it! You can then start using it by requiring the EasyPromise package:

```javascript
var EP = require('easypromise');
```

You will then have access to the library through the variable `EP` (or whatever, you don't have to name it `EP`). Read below for usage details.

## Basic Usage ##

So as stated above, this library was created to solve this common problem which occurs when attempting to chain together asynchronous calls. I've created a working dummy asynchronus call below that will print "done: 4" after about 4 seconds. You can run it in your browser console if you'd like :)

```javascript
/ * Pseudo-asynchronus function I will re-use throughout examples */
var someAsyncFunction = function (data, callback) {
	//To simplify the example, we'll just pass an error object and a param called 'data'
    setTimeout(function () { 
		console.log('inside a callback with data: ', data);
        callback(null, data); //<-Assume 'err' could be potentially passed here in place of null
    }, 1000);
};
/* Begin callback spaghetti nightmare!!! */
someAsyncFunction('one', function(err, data) {
    if (err) {
        console.log(err);
    } else {
        someAsyncFunction('two', function(err, data) {
            if (err) {
                console.log(err);
            } else {
                someAsyncFunction('three', function(err, data) {
                    if (err) {
                        console.log(err);
                    } else {
                        someAsyncFunction('four', function(err, data) {
                            if (err) {
                                console.log(err);
                            } else {
								//Finally made it!!!
								console.log('done: ' + data);
                            }
                        });
                    }
                });
            }
        });
    }
});
```
```text
***Outputs***:
inside a callback with data:  'one'
inside a callback with data:  'two'
inside a callback with data:  'three'
inside a callback with data:  'four'
done: 4

```
As you can see this is completely unmanageable code. Some might say "Oh, just define the callbacks individually at the top of the code instead", or "Aren't there already promise libraries for this?". The answer is yes, you could define your callbacks ahead of time or even use an existing promise library. But there are tons of libraries to choose from and they all have way too lengthy documentation for my tastes. So I present to you, EasyPromise! See the simplified version of the code below using Node.js:


```javascript
var EP = require('easypromise');

EP.create(someAsyncFunction, ['one'], function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed(['two']);
	}
}).then(someAsyncFunction, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed(['three]);
	}
}).then(someAsyncFunction, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed(['four']);
	}
}).then(someAsyncFunction, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		console.log('done: ' + data.foo);
	}
}).run()
```

Ta-da! This is a nice, flattened version of the above code and it works without butchering your original code structure.

### So how does this work?

EasyPromise works by taking an initial asynchronous function that has one or more callbacks as its trailing arguments, and chaining it together with other asynchronous functions that have callbacks of their own. The single available top-level function in the library is as folows:

- **EasyPromise.create(func, [arg1, arg2 .... argN], callback1, callback2, ....callbackN)** - Initiates an EasyPromise function chain definition, and returns an EasyPromise object. The first parameter is a reference to the asynchronous function that you want to run. The second parameter is an array containing the args to pass to your function call, but you omit the callback(s). If the function takes no other arguments, you can omit this parameter altogether. All remaining parameters are the callback functions that are presumed to be the final arguments for your asynchronous function.


So to break things down a bit, as stated above the `create()` function will return what's called an EasyPromise object. This object has utility functions within it to allow you to chain together asynchronous function calls. So for example, the code below would be perfectly valid, though a bit redundant:

```javascript
//Begin defining promise callbacks
var epObject = EP.create(someAsyncFunction, ['arg1', 'arg2'], function(err, data) {
	if(err) {
		console.log(err);
	} else {
		//Scope from EasyPromise exposes the proceed() function
		this.proceed(['arg1', 'arg2']);
	}
});
//Assign same epObject to the next EasyPromise object for simplicity (you could also save it to a new var)
epObject = epObject.then(someAsyncFunction, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed({ foo: 2 });
	}
});
//Execute the chain of promises
epObject.run();
```
So from the above code, you should be able to see more clearly three functions exposed: `then()`, `proceed()`, and `run()`.  Below are a desecription of each:

- **EasyPromise.prototype.then(func, callback)** - Takes a function to run and a callback method, and returns a new EasyPromise child object created from them. Arguments for the asynchronous function are expected to be received from a `proceed()` call from the preceding asynchronous callback function (important!! see `proceed()` below).

- **EasyPromise.prototype.proceed(args...)** - Executes the next EasyPromise child. The scope of callbacks with EasyPromise will be assigned to an EasyPromise object, giving you access to EasyPromise functions via `this`. This also allows you to provide any number of arguments for the subsequent asynchronous function call. This is an important feature of the library, since rather than having you define arguments within the signature for `then()` itself, you can create them in the context of the preceding callback function.

- **EasyPromise.prototype.run(func, callback)** - Starts at the first EasyPromise in the tree and executes its function. Will execute EasyPromise objects as each `proceed()` method is reached in each callback until completion. Because this function traverses up the promise chain before execution, you could actually call `run()` on any of the promise objects within the chain to begin the processing.

(These are the bare minimum functions required to use this library, scroll down more for advanced usage)

**The tricky part** is understanding the difference between the initial `create()` call, and the subsequent `then()`s. The first call will always require the arguments immediately since EasyPromise needs them to kick off the process after `run()` is called, however within `then()` the arguments are injected via the `this.proceed()` call instead. This grants you the ability to dynamically manipulate the arguments of future asynchronous calls. As for the callback function, you can write it just like you would have otherwise, and simply add a `this.proceed()` when you'd like EasyPromise to move to the next asynchronous function. Other than that, I hope that you find this library fairly straightforward! For Advanced Usage continue reading below.

## Advanced Usage

There are additional functions inside the EasyPromise objects that you can use that grant you additional flexibility in your callback flow. See below:

- **EasyPromise.prototype.parent** - A reference to the parent EasyPromise object.

- **EasyPromise.prototype.children** - An object with key-value pairs mapping child EasyPromise names to their definitions.

- **EasyPromise.prototype.options** - An object containing the options for the EasyPromise object. Modify this through use of `config()` for easy use. The available options are below
	- **asyncContext** - *See abind() function, same behavior*
	- **callbackContext** - *See cbind() function, same behavior*


- **EasyPromise.prototype.config(options)** - Assigns a func*tion to be executed immediately before the asynchronous call is executed for the current EasyPromise object.

- **EasyPromise.prototype.abind(context)** - Provide a context to bind to the asynchronous function call. Useful when the function call you want to use needs a specific context (i.e. node-mysql's `connection.query`). (Note: this is a shortcut for `config({ asyncContext: context })`

- **EasyPromise.prototype.cbind(context)** - Provide a context to bind to the callback function. Most often than not, callbacks won't care about a specific context. But if you don't want the callback to be bound to the EasyPromise object itself, simply set it here (Note: this is a shortcut for `config({ callbackContext: context })`. Keep in mind that this will prevent you from using `this.proceed()` in your EasyPromise chain, so you would need to store the value of that EasyPromise object outside the scope of the callbacks.

- **EasyPromise.prototype.before(func)** - Assigns a function to be executed immediately before the asynchronous call is executed for the current EasyPromise object.

- **EasyPromise.prototype.after(func)** - Assigns a function to be executed immediately after the callback function is executed for the current EasyPromise object.

- **EasyPromise.prototype.error(func)** - Assigns a function to capture exceptions for the current EasyPromise object. This function should accept a single argument that will contain the Error object.

- **EasyPromise.prototype.define(name, func, callback)** - Creates and assigns a named EasyPromise child to the current EasyPromise object. This function is similar to the use of `then()`, however instead of returning the new object it saves it as a child node of the current EasyPromise object and returns the original. (Note that when you use `then()`, the corresponding child EasyPromise object is named `'default'` automatically)

- **EasyPromise.prototype.proceedTo(name, args...)** - Executes the next EasyPromise child specified by `name`. This works the same as the normal `proceed()` function but calls a specific child EasyPromise object instead of using the one defined as `'default'` in the children map.

If you decide to use these advanced features, you may want to consider defining EasyPromise objects individually instead of just one long chain. Remember, once you call `then()` you lose a direct reference to the current EasyPromise object. By assigning variables to hold onto to the result of `then()`, it will be easier to manage a large amount of nested pathing. See below for an example:

```javascript
/* Advanced Usage Example */

//Start by saving the root EasyPromise object
var rootEP = EP.create(someAsyncFunction, 'starting', function(err, data) {
	if(err) {
		console.log(err);
	} else {
		//Chose a random path to proceed to
		var path = (Math.random() > 0.66) ? 'path1' :  (Math.random() > 0.33) ? 'path2' : 'default';
		this.proceedTo(path, 'proceeding to path: ' + path);
	}
});
//Creates the default path (could also write "define('default', someAsyncFunction, ...)")
rootEP.then(someAsyncFunction, function(err, data) {
	//The default path
	if(err) {
		console.log(err);
	} else {
		console.log('reached default path\'s callback');
	}
});
//Define extra paths
rootEP.define('path1', someAsyncFunction, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed('continuing down path1');
	}
});
rootEP.define('path2', someAsyncFunction, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed('continuing down path2');
	}
});
//Give the children asynchronous calls to run
rootEP.children['path1'].then(someAsyncFunction, function(err, data) {
	//The default path
	if(err) {
		console.log(err);
	} else {
		console.log('reached the end of path1\'s callbacks');
	}
});
rootEP.children['path2'].then(someAsyncFunction, function(err, data) {
	//The default path
	if(err) {
		console.log(err);
	} else {
		console.log('reached the end of path2\'s callbacks');
	}
});

//Execute the chain of promises
rootEP.run();
```
So the above code defines 3 children EasyPromise objects for the root object: 1 default, and 2 additional children. When you execute the code, it will show the execution path as each of the `data` args from the callbacks are printed to the console. You will see that the chain has a 33% chance of hitting any one of the three final paths.


## Version History ##

**0.1**

- Initial release

----------

Copyrighted © 2014 by Greg McLeod

GitHub: [https://github.com/cleod9](https://github.com/cleod9)