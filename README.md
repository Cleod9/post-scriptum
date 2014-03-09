# EasyPromise.js#

----------

EasyPromise is a promise library I made to be as simple or complex as you need it to be. Unlike other promise libraries (\*cough\*Q\*cough\*), simply understanding how a callback works is more than enough knowledge to be able to use it. The primary purpose of this library is to solve what is known as "callback spaghetti". And by solve, I mean eliminate it altogether. My philosophy here was that a promise library should be able to work with any type of function that has callbacks as trailing parameters, and so long as you are sequentially running asynchronous functions you should never have to nest a callback within a callback. To achieve this, my goals can be outlined as follows:

1. Allow the developer to primarily be able to use the library with functions that contain callbacks as their final argument(s)
1. Allow promises to be chained together like other libraries (removes the spaghetti)
2. Allow the ability initialize the subsequent promise from within a callback (you decide if and when your promise chain continues)
3. Allow extra data to be passed to the next promise from within a callback (eliminates nesting altogether, unlike [this](https://github.com/kriskowal/q#chaining))
4. Allow the ability to traverse down a different promise path depending on the result of a callback
5. Allow the user to customize the binding of their asynchronous function and callbacks as needed.
6. Allow the user to use alternatively chain together "promise-returning" functions (using different means than other promise libraries)

This library attempts to tackle these goals by keeping complexity at a minimum and putting you in the drivers seat of your callback flow. And it's available for both the browser and Node.js!

## Installation ##

### For Node.js ###

```
npm install easypromise
```

And that's it! You can then start using it by requiring the EasyPromise package:

```javascript
var EP = require('easypromise');
```

You will then have access to the library through the variable `EP` (or whatever, you don't have to name it `EP`). Scroll down for usage details.

### For Browser ###

Simply grab the library from `lib/easypromise.js` and include it in your web page. You will then have access to the global variable called `EasyPromise`.

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
As you can see this is completely unmanageable code. Some might say "Oh, just define the callbacks individually at the top of the code instead", or "Aren't there already promise libraries for this?". The answer is yes, you could define your callbacks ahead of time or even use an existing promise library. But there are tons of libraries to choose from and they all have way too convoluted documentation for my tastes. So I present to you, EasyPromise! See the simplified version of the code below (Node.js):


```javascript
var EP = require('easypromise');

//EasyPromise's equivalent of "someAysncFunction('one', function(err, data)) {})"
EP.create(someAsyncFunction, ['one'], function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed(['two']); //<-Args for the next async call determined here :)
	}
}).then(someAsyncFunction, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed(['three']);
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

Ta-da! This is a nice, flattened version of the earlier code and it works without butchering your original code structure.

### So how does this work?

EasyPromise works by taking an initial asynchronous function that has one or more callbacks as its trailing arguments, and chaining it together with other asynchronous functions that have callbacks of their own. The single available top-level function in the library is as folows:

- `EasyPromise.create(func, [arg1, arg2 .... argN], callback1, callback2, ....callbackN)` - Static method that initiates an EasyPromise chain definition, and returns an EasyPromise object. This is actually a shorthand for writing `new EasyPromise(…)` which is safe to use for the first call, though it is recommended that you let the library take care of constructing the remaining promises for you to avoid confusion. The first parameter is a reference to the asynchronous function that you want to call. The second parameter is an array containing the args to pass to your function call, but you omit the callback(s). If the function takes no other arguments, you can omit this parameter altogether. All remaining parameters are the callback functions that are presumed to be the final arguments for your asynchronous function. **Note that your asynchronous function chain is not executed until `run()` is called, which will be described below.**


So to break things down a bit, as stated above the `create()` function will return what's called an EasyPromise object. This object has utility functions within it to allow you to chain together asynchronous function calls. So for example, the code below would be perfectly valid, though a bit redundant:

```javascript
//Begin by creating an initial promise
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
		this.proceed(['arg1', 'arg2']);
	}
});
//Execute the chain of promises
epObject.run();
```
So from the above code, you should be able to see more clearly three EasyPromise functions exposed: `then()`, `proceed()`, and `run()`.  Below are a desecription of each of these functions which are all a part of the EasyPromise object prototype:

- `then(func, callback1, callback2, ....callbackN)` - Takes a function to run and its callback method(s), and returns a new EasyPromise child object created from them. Note that the other arguments for this asynchronous function are not placed here,  they are expected to be received from a `proceed()` call from the preceding asynchronous callback function **(very important!! see `proceed()` below).**

- `proceed(fnArgs)` - Executes the next EasyPromise child,  accepting an array of arguments `fnArgs` to be applied to its asynchronous function call. The scope of callbacks with EasyPromise by default will be assigned to their EasyPromise wrapper, giving you access to EasyPromise functions via `this`. This is an important feature of the library, since rather than having you define arguments within the signature for `then()` itself, you can create them in the context of the preceding callback function.

- `run()` - Starts at the first EasyPromise in the tree and executes its function. It will execute EasyPromise objects as each `proceed()` method is reached in each callback until completion. (Side Note: Because this function traverses up the promise chain before execution, you could actually call `run()` on any of the promise objects within the chain to begin the processing)

These are the bare minimum functions required to use this library, scroll down more for advanced usage

**The tricky part** is understanding the difference between the initial `create()` call, and the subsequent `then()`s. The first call will always require the arguments immediately since EasyPromise needs them to kick off the process after `run()` is called, however within `then()` the arguments are injected via the `this.proceed()` call instead. This grants you the ability to dynamically manipulate the arguments of future asynchronous calls. As for the callback function, you can write it just like you would have otherwise, and simply add a `this.proceed()` when you'd like EasyPromise to move to the next asynchronous function. Other than that, I hope that you find this library fairly straightforward! For Advanced Usage continue reading below.

## Advanced Usage ##

There are many additional functions from the EasyPromise object prototype that you can use which grant you additional flexibility in your callback flow. 

- `parent`- A reference to the parent EasyPromise object.

- `children` - An object with key-value pairs mapping child EasyPromise names to their definitions. When using `then()` the key will always be `'default'` to identify the child. This is a helpful property to use if you have modified the binding of your callback, and want to pass the promise object itself as an additional argument from the preceding callback via `proceedWith()` (see more below).

- `options` - An object containing the options for the EasyPromise object. Modify this through `config()` for ease of use. The available options are below
	- `asyncContext` - *See abind() function, same behavior*
	- `callbackContext` - *See cbind() function, same behavior*
	- `prependArgs` - Array of arguments to prepend to the promise's callback functions. (A bit redundant to use through `config()`, use via `proceedWith()` instead)


- `config(options)` - Chainable method to modify the options object for the EasyPromise object.

- `abind(context)` - Chainable method that provides a context to bind to the asynchronous function call. Useful when the function call you want to use needs a specific context (e.g. node-mysql's `connection` object). Note that this is a shortcut for `config({ asyncContext: context })`

- `cbind(context)` - Chainable method that provides a context to bind to the callback function. Most often than not, callbacks you write probably won't care about a specific context. But if you don't want the callback to be bound to the EasyPromise object itself, simply set it here. Keep in mind that this will prevent you from using `this.proceed()` in your EasyPromise chain, so you would need to store the value of that EasyPromise object outside the scope of the callbacks or pass it down with clever use of `proceedWith()`. Note that this is a shortcut for `config({ callbackContext: context })`. 

- `prepend(prependArgs)` - Accepts an Array of arguments that will be prepended to the callback(s) function signature for the current EasyPromise object. As stated with `config({prependArgs: ...})`, usually you will exclusively want to prepend arguments via `proceedWith()` instead of this function (especially since this function applies to only the current promise and not the subsequent one). Also, with `proceedWith()` you could utilize data within the scope of the callback. **(See `proceedWith()` for example)**

- `before(func)` - Chainable method that assigns a function to be executed immediately before the asynchronous call is executed for the current EasyPromise object.

- `after(func)` - Chainable method that assigns a function to be executed immediately after the callback function is executed for the current EasyPromise object.

- `error(func)` - Chainable method that assigns a function to capture exceptions for the current EasyPromise object. This function should accept a single argument that will contain the Error object.

- `catch(func)` - Chainable method that assigns a function to capture exceptions for the entire EasyPromise tree. This function should accept a single argument that will contain the Error object.

- `define(name, func, callback)` - Chainable method that creates and assigns a named EasyPromise child to the current EasyPromise object. This function is similar to the use of `then()`, however instead of returning the new object it saves it as a child node of the current EasyPromise object and returns the original. This way you can define multiple named EasyPromise children, and target them via the `proceedTo()` function. Note that in reality when you use `then()`, the corresponding child EasyPromise object is actually named `'default'` automatically. **This is one of the more powerful advanced features, allowing you to conditionally branch out into different promise paths from within your callbacks.**

- `proceedTo(name, fnArgs)` - Same behavior as `proceed()` but executes the next EasyPromise child specified by `name`. By default when you call `proceed()`, it is actually calling `proceedTo()` using the name `'default'`. With the help of this function you can selectively choose a particular promise path to travel down depending on the results of a callback.

- `proceedWith(callbackPrependArgs, fnArgs)` - Executes the next EasyPromise child specified by `name` and passes an array of arguments `callbackPrependArgs` to be prepended to the callback function signature, followed by the second array of arguments `fnArgs` to be applied to its asynchronous function call. This works the same as the normal `proceed()` function but has a bonus feature of letting you pass additional arguments to a callback. So if you had a callback that had `(err, data)` as parameters, by calling `proceedWith(['customVal'], ['arg1', 'arg2'])` you would be effectively modifing the callback's parameters to be come `(customArg, err, data)`.

- `proceedToWith(name, callbackPrependArgs, fnArgs)` - Same behavior as `proceedWith()` but executes the next EasyPromise child specified by `name`.


If you decide to use named promises along with all of these other advanced features, you may want to consider defining EasyPromise objects individually instead of just one long chain. Remember, once you call `then()` you lose a direct reference to the current EasyPromise object. By assigning variables to hold onto to the result of `then()`, it will be easier to manage a large amount of nested pathing. See below for an example:

```javascript
/* Advanced Usage Example */

//Start by saving the root EasyPromise object
var rootEP = EP.create(someAsyncFunction, ['starting'], function(err, data) {
	//Chose a random path to proceed to
	var path = (Math.random() > 0.66) ? 'path1' :  (Math.random() > 0.33) ? 'path2' : 'default';
	this.proceedTo(path, ['proceeding to path: ' + path]);
});
//Creates the default path (could tecnhically also write "define('default', someAsyncFunction, ...)")
rootEP.then(someAsyncFunction, function(err, data) {
	//The default path
	console.log('reached default path\'s callback');
});
//Define extra paths
rootEP.define('path1', someAsyncFunction, function(err, data) {
	this.proceed(['continuing down path1']);
});
rootEP.define('path2', someAsyncFunction, function(err, data) {
	this.proceed(['continuing down path2']);
});
//Give the children asynchronous calls to run
rootEP.children['path1'].then(someAsyncFunction, function(err, data) {
	//The default path
	console.log('reached the end of path1\'s callbacks');
});
rootEP.children['path2'].then(someAsyncFunction, function(err, data) {
	//The default path
	console.log('reached the end of path2\'s callbacks');
});

//Execute the chain of promises
rootEP.run();
```
So the above code defines 3 children EasyPromise objects for the root object: 1 default, and 2 additional children. When you execute the code, it will demonstrate the execution path as each of the `data` args from the callbacks are printed to the console. You will see that the chain has a 33% chance of hitting any one of the three final paths.


## Version History ##

**0.1**

- Initial release

----------

Copyrighted © 2014 by Greg McLeod

GitHub: [https://github.com/cleod9](https://github.com/cleod9)