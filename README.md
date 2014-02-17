# EasyPromise (Node.js)#

----------

EasyPromise is a library I made because I felt that other promise libraries over-complicated things. The purpose of this library is to solve one thing, and that what is known as callback spaghetti. As I see it, there are two main difficulties when attempting to simplify asynchronous callback behavior:

1. Defining many functions without having to assign them all to variables to condense the code
2. Re-using the arguments/vars from a previous asynchronous call

This library attempts to address these issues by keeping complexity at a minimum while still allowing flexibility in controlling your callback flow.

## Installation ##

```
npm install easypromise
```

And that's it! You can then start using it by requiring the EasyPromise package:

```javascript
var EP = require('easypromise');
```

You will then have access to the library through the variable `EP` (or whatever, you don't have to name it `EP`). Read below for usage details.

## Usage ##

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
```
```javascript
/* Begin callback spaghetti nightmare!!! */
someAsyncFunction({ foo: 1}, function(err, data) {
    if (err) {
        console.log(err);
    } else {
        someAsyncFunction({ foo: 2}, function(err, data) {
            if (err) {
                console.log(err);
            } else {
                someAsyncFunction({ foo: 3}, function(err, data) {
                    if (err) {
                        console.log(err);
                    } else {
                        someAsyncFunction({ foo: 4}, function(err, data) {
                            if (err) {
                                console.log(err);
                            } else {
								//Finally made it!!!
								console.log('done: ' + data.foo);
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
inside a callback with data:  { foo: 1 }
inside a callback with data:  { foo: 2 }
inside a callback with data:  { foo: 3 }
inside a callback with data:  { foo: 4 }
done: 4

```
As you can see this is completely unmanageable code. Some might say "Oh, just define the callbacks individually at the top of the code instead", or "Aren't there already promise libraries for this?". The answer is yes, you could define your callbacks ahead of time or even use an existing promise library. But there are tons of libraries to choose from and they all have way too lengthy documentation for my tastes. So I present to you, EasyPromise! See the simplified version of the code below using Node.js:


```javascript
var EP = require('easypromise');

EP.begin(someAsyncFunction, { foo: 1}, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed({ foo: 2 });
	}
}).then(someAsyncFunction, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed({ foo: 3 });
	}
}).then(someAsyncFunction, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed({ foo: 4 });
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

So EasyPromise works by taking an initial asynchronous function that has a callback as its final argument, and chaining it together with other asynchronous functions that have callbacks of their own. The two available top-level functions in the library are the following:

- **EasyPromise.begin(func, args... , callback)** - Initiates defining an EasyPromise function chain, and returns an EasyPromise object. The first object is a reference to the function that you want to run. EasyPromise will take the remaining arguments and use them as parameters for your function call.

- **EasyPromise.test()** - Runs some simple test code which demonstrates the use of EasyPromise

So to break things down a bit, as stated above the `begin()` function will return what's called an EasyPromise object. This object has utility functions within it to allow you to chain together asynchronous function calls. So for example, the code below would be perfectly valid, though a bit redundant:

```javascript
//Begin defining promise callbacks
var epObject = EP.begin(someAsyncFunction, data, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		//Scope from EasyPromise exposes the proceed() function
		this.proceed({ foo: 1 });
	}
});
//Assign epObject to the next EasyPromise object
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

- **EasyPromise.prototype.proceed(args...)** - Executes the next EasyPromise child. The scope of callbacks with EasyPromise will be assigned to an EasyPromise object, giving you access to EasyPromise functions via `this`. This also allows you to provide any number arguments for the subsequent asynchronous function call. This is an important feature of the library, since rather than having you define arguments within the signature for `then()` itself, you can create them in the context of the preceding callback function.

- **EasyPromise.prototype.run(func, callback)** - Starts at the first EasyPromise in the tree and executes its function. Will execute EasyPromise objects as each `proceed()` method is reached in each callback until completion.

These are the bare minimum functions required to use this library. Note that I assign the initial EasyPromise object `epObject` to the result of `then()`, otherwise `then()` would overwrite the first object's child EasyPromise object.

**The tricky part** is understanding the difference between the initial `begin()` call, and the subsequent `then()`s. The first call will always require the arguments immediately so they are passed in right away, however with `then()` the arguments are injected via the `proceed()` call instead. This grants you the ability to dynamically manipulate the arguments of future asynchronous calls. As for the callback function, you can write it just like you would have otherwise, and simply add a `this.proceed()` when you'd like EasyPromise to move to the next asynchronous function. Other than that, I hope that you find this library fairly straightforward! For Advanced Usage read below.

## Advanced Usage

There are additional functions inside the EasyPromise object that you can use that grant you additional flexibility in your callback flow. See below:

- **EasyPromise.prototype.parent** - A reference to the parent EasyPromise object.

- **EasyPromise.prototype.children** - An object with key-value pairs mapping child EasyPromise names to their definitions.

- **EasyPromise.prototype.before(func)** - Assigns a function to be executed immediately before the asynchronous call is executed for the current EasyPromise object.

- **EasyPromise.prototype.after(func)** - Assigns a function to be executed immediately after the callback function is executed for the current EasyPromise object.

- **EasyPromise.prototype.error(func)** - Assigns a function to capture exceptions for the current EasyPromise object. This function should accept a single argument that will contain the Error object.

- **EasyPromise.prototype.define(name, func, callback)** - Creates and assigns a named EasyPromise child to the current EasyPromise object. This function is similar to the use of `then()`, however instead of returning the new object it saves it as a child node of the current EasyPromise object and returns the original. (Note that when you use `then()`, the corresponding child EasyPromise object is named `'default'` automatically)

- **EasyPromise.prototype.proceedTo(name, args...)** - Executes the next EasyPromise child specified by `name`. This works the same as the normal `proceed()` function but calls a specific child EasyPromise object instead of using the one defined as `'default'` in the children map.

If you decide to use these advanced features, you may want to consider defining EasyPromise objects individually instead of just one long chain. Remember, once you call `then()` you lose a direct reference to the current EasyPromise object. By assigning variables to hold onto to the result of `then()`, it will be easier to manage a large amount of nested pathing. See below for an example:

```javascript
/* Advanced Usage Example */

//Start by saving the root EasyPromise object
var rootEP = EP.begin(someAsyncFunction, 'starting', function(err, data) {
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