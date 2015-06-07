# PostScriptum.js#

----------

**PostScriptum.js **is a promise-like JavaScript library designed to eradicate what is known as "callback hell/spaghetti", which can occur very easily when using a callback pattern extensively. The name comes from the acronym "P.S." or "post script" that is written at the end of written letters to indicate some additional information or afterthought. When writing many callbacks that rely on one another, it can sometimes be tricky to share information between them. PostScriptum makes passing information along multiple callback chains easier to manage.

The goals behind this library were as follows:

1. Allow the developer to be able to use the library with any functions that contain callbacks as their trailing argument(s)
2. Allow callback sequences to be chained together (removes the spaghetti)
3. Allow the ability initialize the subsequent callbacks from within a callback (callback chain flow)
4. Allow extra data to be passed to the next callback from within a callback (eliminates the need to hoist)
5. Allow the ability to conditionally execute specific callbacks within callbacks ("named" callback branching)
6. Allow the developer to chain together "callback-returning" functions (akin to promises returning promises)

This library tackles these goals by keeping complexity at a minimum and putting you in the drivers seat of your callback flow. And it's available for both the browser and Node.js!

# \*\*Disclaimer\*\* #

**This library does NOT follow the [Promises/A+](http://promisesaplus.com/) specification, nor is it designed to be compatible with the spec.** This library provides a different approach to "promises" than the abstraction presented by the A+ specification. While "true" promise libraries may useful in many cases, I simply found this particular library I created to be more useful for what I needed to accomplish. It is not designed to be a replacement for traditional promise libraries, but nonetheless should be able to handle a large variety of use cases. It is currently being used for live production code, so it's definitely ready for prime-time.


## Installation ##

### For Node.js ###

```
npm install post-scriptum
```

And that's it! You can then start using it by requiring the `post-scriptum` module:

```javascript
var PS = require('post-scriptum');
```

You will then have access to the library through the variable `PS` (or whatever other name you chose). Scroll down for usage details.

### For Browser ###

Simply download the library from `post-scriptum.js` and include it in your web page. You will then have access to the global variable called `PS`.

## Basic Usage ##

So as stated above, this library was created to solve this common problem which occurs when attempting to chain together asynchronous calls. I've created a working dummy asynchronus call below that will print "done: 4" after about 4 seconds. You can run it in your browser console if you'd like :)

```javascript
/ * Pseudo-asynchronus function I will re-use throughout examples */
var someAsyncFunction = function (data, callback) {
	//To simplify the example, we'll just pass an error object and a param called 'data' after 1 second
    setTimeout(function () { 
		console.log('inside a callback with data: ', data);
        callback(null, data); //<-Assume an error object could be passed here in place of null
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
As you can see this is completely unmanageable code. While there are definitely ways to work around this,  PostScriptum makes this easier by providing a flat construct for you. See the simplified version of the code below (Node.js):


```javascript
var PS = require('post-scriptum');

//PostScriptum's equivalent of "someAysncFunction('one', function(err, data)) {})"
PS.create(someAsyncFunction, ['one'], function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed(['two']); //<-Args for the next async call can be placed here
	}
}).then(someAsyncFunction, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		//Because we know the next value, can provide 'three' outside of this scope too if we want
		this.proceed();
	}
}).then(someAsyncFunction, ['three'], function(err, data) {
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

Ta-da! This is a nice, flattened version of the earlier code with very little abstraction.

### So how does this work?

PostScriptum works by taking an asynchronous function that has one or more callbacks as its trailing arguments, and saving the arguments in an array for later execution. As a result, you can define the behavior for a chain of these PostScriptum instances **before** actually exeucting anything. This all begins with `PostScriptum.create()`:

- `PostScriptum.create(asyncFunc, [arg1, arg2 .... argN], callback1, callback2, ....callbackN)` - Static method that instantiates a new PostScriptum object and returns it. (This is actually a shorthand for writing `new PostScriptum(…)`). The first parameter is a reference to the asynchronous function that you want to call. The second parameter is an array containing the args to pass to your function call, but you omit the callback(s) arguments. If the function takes no other arguments besides a callback, you can omit this parameter altogether. All remaining parameters are the callback functions that are presumed to be the trailing arguments for your asynchronous function. **Note that your asynchronous function chain is not executed until `run()` is called, which will be described below.**


So to break things down a bit, as stated above the `create()` function will return a PostScriptum object. This object has utility functions within it to allow you to chain together asynchronous function calls. So for example, the code below would be perfectly valid, though a bit redundant:

```javascript
//Begin by creating an initial PostScriptum instance
var psInstance = PS.create(someAsyncFunction, ['arg1', 'arg2'], function(err, data) {
	if(err) {
		console.log(err);
	} else {
		//Context from PostScriptum exposes the proceed() function
		this.proceed(['arg1', 'arg2']);
	}
});
//Assign same psInstance to the next PostScriptum object for simplicity (alternatively save it to a separate variable)
psInstance = psInstance.then(someAsyncFunction, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		this.proceed(['arg1', 'arg2']);
	}
});
//Execute the chain of PostScriptum instances
psInstance.run();
```
So from the above code, you should be able to see more clearly three different exposed PostScriptum functions: `then()`, `proceed()`, and `run()`. These functions are bound to the function callback's `this` by default for easy access. Below is a description of each of these functions which are all a part of the PostScriptum object prototype:

- `proceed(fnArgs)` - Executes the next PostScriptum child,  accepting an optional array of arguments `fnArgs` to be applied to its asynchronous function call. The context within PostScriptum callbacks is assigned to their PostScriptum instance by default, giving you access to PostScriptum functions via `this`. This is an important feature of the library, since it allows you to manipulate the behavior of your PostScriptum instance from within a callback. **(If you don't want the `this` context to be violated by PostScriptum, see the `cbind()` function)**

- `then(func, [arg1, arg2 .... argN], callback1, callback2, ....callbackN)` - Takes a function to run and its callback method(s), and returns a new PostScriptum child object with those parameters. Note that the non-callback arguments for this asynchronous function can alternatively be placed inside a `proceed()` call from the preceding asynchronous callback function
**Important: If you specify non-callback arguments both within `then()` and the preceeding `proceed()` call, the two argument arrays will be concatenated with the `then()` arguments listed first.** 

- `run()` - Starts at the root PostScriptum instance in the tree and executes its asynchronous function using its provided arguments. It will execute subsequent PostScriptum objects as each `proceed()` method is reached in each callback until the entire chain has been evaulated.
**(Side Note: Because this function traverses up the PostScriptum chain before execution, you could actually call `run()` on any of the PostScriptum objects within the chain to begin the processing)**

These are the bare minimum functions required to use this library.

**Confused a bit?** The tricky part is understanding the difference between the initial `create()` call, and the subsequent `then()`s. The first call will always require the arguments immediately since PostScriptum needs them to kick off the process after `run()` is called, however within `then()` the arguments can be injected via the `this.proceed()` call instead. This grants you the ability to dynamically manipulate the arguments of future asynchronous calls. As for the callback function, you can write it just like you would have otherwise, and simply add a `this.proceed()` when you'd like PostScriptum to move to the next asynchronous function. Other than that, I hope that you find this library fairly straightforward! For Advanced Usage continue reading below.

## Advanced Usage ##

There are many additional functions from the PostScriptum object prototype that you can use which grant you additional flexibility in your callback flow. 

- `parent()`- Returns the parent PostScriptum object.

- `children` - An object with key-value pairs mapping child PostScriptum names to their definitions. When using `then()` the key will always be `'default'` to identify the child. This is a helpful property to use if you have modified the binding of your callback, and want to pass the PostScriptum object itself as an additional argument from the preceding callback via `proceedWith()` (see more below).

- `options` - An object containing the options for the PostScriptum object. Modify this through `config()` for ease of use. The available options are below
	- `asyncContext` - *See abind() function, same behavior*
	- `callbackContext` - *See cbind() function, same behavior*
	- `prependArgs` - Array of arguments to prepend to the PostScriptum instance's callback functions. (See `proceedWith()` for equivalent)


- `config(options)` - Chainable method to modify the options object for the PostScriptum object. Returns the same PostScriptum object that it was called on.

- `abind(context)` - Chainable method that provides a context to bind to the asynchronous function call. Useful when the function call you want to use needs a specific context (e.g. node-mysql's `connection` object). Note that this is a shortcut for `config({ asyncContext: context })`. Returns the same PostScriptum object that it was called on.

- `cbind(context)` - Chainable method that provides a context to bind to the callback function. Most often than not, callbacks you write probably won't care about a specific context. But if you don't want the callback to be bound to the PostScriptum object itself, simply set it here. Keep in mind that this will prevent you from using `this.proceed()` in your PostScriptum chain, so you would need to store the value of that PostScriptum object outside the scope of the callbacks or pass it down with clever use of `proceedWith()`. (Also note that this is a shortcut for `config({ callbackContext: context })`.)  This function returns the same PostScriptum object that it was called on.

- `prepend(prependArgs)` - Accepts an Array of arguments that will be prepended to the callback(s) function signature for the current PostScriptum object. As stated with `config({prependArgs: ...})`, usually you will exclusively want to prepend arguments via `proceedWith()` instead of this function (especially since this function applies to only the current PostScriptum instance and not the subsequent one). Also, with `proceedWith()` you could utilize data within the scope of the callback. **(See `proceedWith()` for example)** Returns the same PostScriptum object that it was called on.

- `before(func(psInstance))` - Chainable method that assigns a function to be executed immediately before the asynchronous call is executed for the current PostScriptum object. Returns the same PostScriptum object that it was called on. The scope of this function is not manipulated by PostScriptum, and the current PostScriptum instance is received as the first argument of the function call.

- `after(func(psInstance))` - Chainable method that assigns a function to be executed immediately after the callback function is executed for the current PostScriptum object. Returns the same PostScriptum object that it was called on. The scope of this function is not manipulated by PostScriptum, and the current PostScriptum instance is received as the first argument of the function call. 

- `error(func(err))` - Chainable method that assigns a function to capture exceptions for the current PostScriptum object. This function should accept a single argument that will contain the Error object. Returns the same PostScriptum object that it was called on.

- `catch(func(err))` - Chainable method that assigns a function to capture exceptions for the entire PostScriptum tree. This function should accept a single argument that will contain the Error object. Returns the same PostScriptum object that it was called on.

- `define(name, func, callback)` - Chainable method that creates and assigns a named PostScriptum child to the current PostScriptum object. This function is similar to the use of `then()`, however instead of returning the new object it saves it as a child node of the current PostScriptum object and returns the original. This way you can define multiple named PostScriptum children, and target them via the `proceedTo()` function. Note that in reality when you use `then()`, the corresponding child PostScriptum object is actually named `'default'` automatically.   **This is one of the more powerful advanced features, allowing you to conditionally branch out into different PostScriptum instance paths from within your callbacks. Though use it sparingly or it could get messy!** 

- `proceedTo(name, fnArgs)` - Same behavior as `proceed()` but executes the next PostScriptum child specified by `name`. By default when you call `proceed()`, it is actually calling `proceedTo()` using the name `'default'`. With the help of this function you can selectively choose a particular PostScriptum instance path to travel down depending on the results of a callback. Does not return a value.

- `proceedWith(callbackPrependArgs, fnArgs)` - Executes the next PostScriptum child. It passes an array of arguments `callbackPrependArgs` to be prepended to the callback function signature, followed by the optional second array of remaining arguments `fnArgs` to be applied to its asynchronous function call. This works the same as the normal `proceed()` function but has a bonus feature of letting you pass additional arguments to a callback. So if you had a callback that had `(err, data)` as parameters, by calling `proceedWith(['customVal'], ['arg1', 'arg2'])` you would be effectively modifing the callback's parameters to be come `(customArg, err, data)`. Does not return a value.

- `proceedToWith(name, callbackPrependArgs, fnArgs)` - Same behavior as `proceedWith()` but executes the next PostScriptum child specified by `name`. Does not return a value.


If you decide to use named PostScriptum instances along with all of these other advanced features, you may want to consider defining PostScriptum objects individually instead of just one long chain. Remember, once you call `then()` you lose a direct reference to the current PostScriptum object. By assigning variables to hold onto to the result of `then()`, it will be easier to manage a large amount of nested pathing. See below for an example:

```javascript
/* Advanced Usage Example */

//Start by saving the root PostScriptum object
var rootPS = PS.create(someAsyncFunction, ['starting'], function(err, data) {
	//Chose a random path to proceed to
	var path = (Math.random() > 0.66) ? 'path1' :  (Math.random() > 0.33) ? 'path2' : 'default';
	this.proceedTo(path, ['proceeding to path: ' + path]);
});
//Creates the default path (could tecnhically also write "define('default', someAsyncFunction, ...)")
rootPS.then(someAsyncFunction, function(err, data) {
	//The default path
	console.log('reached default path\'s callback');
});
//Define extra paths
rootPS.define('path1', someAsyncFunction, function(err, data) {
	//Can prepends arguments to the next callback
	this.proceedWith(['i came from path1'], ['continuing down path1']);
});
rootPS.define('path2', someAsyncFunction, function(err, data) {
	//Can prepends arguments to the next callback
	this.proceedWith(['i came from path2'], ['continuing down path2']);
});
//Give the children asynchronous calls to run
rootPS.children['path1'].then(someAsyncFunction, function(extraArg, err, data) {
	//The default path
	console.log('reached the end of path1\'s callbacks');
	console.log('extra argument: ' + extraArg);
});
rootPS.children['path2'].then(someAsyncFunction, function(extraArg, err, data) {
	//The default path
	console.log('reached the end of path2\'s callbacks');
	console.log('extra argument: ' + extraArg);
});

//Execute the chain of PostScriptum instances
rootPS.run();
```
So the above code defines 3 child PostScriptum objects for the root object: 1 default, and 2 additional children. When you execute the code, it will demonstrate the execution path as each of the `data` args from the callbacks are printed to the console. You will see that the chain has a 33% chance of hitting any one of the three final paths.

## Super Advanced Usage (Promise-Like callbacks)##


###  pcreate(), pthen(), pdefine(), resolve(), and reject() ###

There are five more functions that I didn't mention above which offer the ultimate control in breaking down asynchronous callback functions and resemble more traditional promise mechanisms. Their behavior is described below

- `PostScriptum.pcreate(func, [arg1, arg2 .... argN], onResolved, onRejected)` - Works similar to `create()`, however PostScriptum is informed that `func` returns a PostScriptum object which allows special promise-like behavior. The callback arguments in this case are limited to a resolved handler and a rejected handler. This allows you to get your code to resemble a more traditional promise structure. See the upcoming code for an example.

- `pthen(func, [arg1, arg2 .... argN], onResolved, onRejected)` - Works similar to `then()`, however PostScriptum is then informed that `func` returns a PostScriptum object which allows special promise-like behavior. The callback arguments in this case are limited to a resolved handler and a rejected handler. This allows you to get your code to resemble a more traditional promise structure. See the upcoming code for an example.

- `pdefine(name, func, [arg1, arg2 .... argN], onResolved, onRejected)` - Works similar to `define()`, but with the behavior of `pthen()`.

- `resolve()` - Using `this.resolve()` within a callback will result in the parent PostScriptum object to enter its onResolved handler. Contrary to normal promises, you can pass any number of arguments here to the handler.

- `reject()` - Using `this.reject()` within a callback will result in the parent PostScriptum object to enter its onRejected handler. Contrary to normal promises, you can pass any number of arguments here to the handler.

**The below pseudo-code demonstrates how you might use this with node-mysql:**

```javascript
var mysql = mysql = require("mysql");
var db = mysql.createPool({ /* config settings */ });

//Creating a PostScriptum wrapper for node-mysql
var query = function (query, params) {
  var instance = PostScriptum.create(db.query, [query, params || []], function (err, rows, fields) {
    if (err) {
      this.reject(err)
    } else {
      this.resolve(rows, fields)
    } 
  }).abind(db); //<-required for node-mysql, binds "query" function to "db" object

  return instance;
};

//Get user function
var authenticateUser = function (username, password) {
  var instance = PostScriptum.pcreate(query, ['SELECT * FROM users WHERE username = ? AND password = ?', [username, password]], function (rows, fields) {
    if (rows.length <= 0)
      this.reject("User not found or password incorrect."); //Pass message to the parent's rejection handler
    } else {
      this.resolve(rows[0]); //Pass user info to the parent's resolved handler
    } 
  } function (err) {
    this.reject(err); //Pass query()'s error into the parent's rejection handler
  });

  return instance;
};
//Get user's posts
var getUserPosts = function (user_id) {
  //Can alternatively use the normal create() like below, PostScriptum automatically detects it returned a PS instance
  var instance = PostScriptum.create(query('SELECT * FROM posts WHERE creator_id = ?', [user_id]), function (rows, fields) {
    this.resolve(rows); //Pass posts array to the parent's resolved handler
  } function (err) {
    this.reject(err); //Pass query()'s error into the parent's rejection handler
  });

  return instance;
};

/* Let's see the above functions in action! */

PostScriptum.create(authenticateUser('bob', 'pass123'), function (user) {
  //This is the resolved handler, we'll pass user_id to getUserPosts() and prepend the user object as a callback arg
  this.proceedWith([user], [user.user_id])
}, function (err) {
  //This is the rejected handler
  console.log(err);
}).pthen(getUserPosts, function (user, posts) {
  //Received its arguments from the previous callback
  console.log('Successfully found ' + posts.length + ' for user ' + user.name);
}, function (err) {
  console.log(err);
}).run();
```

The above code demonstrates how PostScriptum can be used to break down your callback routines into increasingly smaller functions, and separate these functions from your main code. To summarize, what I did was wrap node-mysql's `connection.query()` function into a PostScriptum object. I then created other functions that run my new version of query() to perform the tasks of getting a user and post information. Once I have defined these routines, I can then make use of them in whatever combination I'd like and share values between them. 

The trick here is that PostScriptum acts more like building blocks for asynchronus function handling, since nothing is ever executed until you call `run()`. It also becomes a conduit for passing resolved PostScriptum instance values down potentially long chains of PostScriptum instances. As a result, there should never be a need for any nested callbacks in your code, and you can decide for yourself when you want to use a traditional callback, and when you want to use more promise-like callback.

So if you're looking for an alternative to promise libraries to manage your asyncronous callbacks, give PostScriptum a shot! Also be sure to check out the **test.js** file for further examples.

----------

Copyrighted © 2015 by Greg McLeod

GitHub: [https://github.com/cleod9](https://github.com/cleod9)