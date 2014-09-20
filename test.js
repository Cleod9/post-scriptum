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
	}, 1000);
};

var mode = 2; //Toggle this to run the different tests

if(mode === 1) {
	//Run asyncFn with the the remaining arguments as parameters
	 EP.create(asyncFn, [{ id: 1 }], function (data) {
		console.log('inside the first function callback', data);
		//Demonstrates how proceed will pass data along as params to the next async call
		this.proceed([{ id: data.id + 1 }]);
	}, function(data) {
		console.log('inside of the alternate callback');
		this.proceed([{ id: data.id + 1 }]);
	}).before(function() {
		console.log('inside before() of the first callback');
	}).then(asyncFn, function(data) {
		console.log('inside the second function callback', data);
		this.proceedWith(['oh hey'], [{ id: data.id + 1 }]);
	}).after(function() {
		console.log('inside after() of the first callback');
	}).then(asyncFn, function(extra, data) {
		console.log('inside the third function callback', data, ' w/ extra data: ', extra);
	}).after(function () {
		console.log("Inside the after() for the final callback");
	}).catch(function(err) {
		console.log(err);
	}).finish(function() {
		console.log('In finish()');
	}).run(); 

} else if (mode === 2) {
	//More traditional promise-like usage (when you want to define all of your promises in advance for re-use)
	var db = {
		users: [
			{ user_id: 0, name: "Bob" },
			{ user_id: 1, name: "Larry" }
		],
		posts: [
			{ post_id: 0, user_id: 0, text: "hello world" },
			{ post_id: 1, user_id: 1, text: "the quick brown fox" },
			{ post_id: 2, user_id: 0, text: "42" }
		]
	};

	function getUser(name) {
		console.log("getUser(\"" + name + "\")");
		//Basic function to find the user with the given name
		var fn = function (success, error) {
			//Artificial delay
			setTimeout(function() {
				var results = [];
				for (var i in db.users) {
					if(db.users[i].name.toLowerCase() === name.toLowerCase()) {
						results.push(db.users[i]);
					}
				}
				if(Math.random() > 0.25)
					success(results);
				else
					error('Error has occured in getUser()'); //25% chance an error for testing purposes
			}, 1000);
		};

		//Create a promise object that has only a success and error handler
		var promise = new EP(fn, function (results) {
			//Success handler right before wrapper promise callback executes
			this.resolve(results);
		}, function(err) {
			//Error handler right before wrapper promise callback executes
			this.reject(err);
		});

		return promise;
	}
	function getPosts(id) {
		console.log("getPosts(" + id + ")");
		//Basic function to find the posts by the given user id
		var fn = function (success) {
			//Artificial delay
			setTimeout(function() {
				var results = [];
				for (var i in db.posts) {
					if(db.posts[i].user_id === id) {
						results.push(db.posts[i]);
					}
				}
				success(results);
			}, 1000);
		};
		var promise = new EP(fn, function (results) {
			//Success handler right before wrapper promise callback executes
			this.resolve(results);
		});

		return promise;
	}

	console.log("Initiating DB search...");

	EP.create(getUser("bob"), function (rows) {
		if(rows.length >= 0) {
			console.log('found user:', rows[0]);
			this.proceed([rows[0].user_id]);
		}
	}, function (err) {
		console.log(err);
	}).pthen(getPosts, function (rows) {
		console.log('posts by this user: ', rows);
	}).run();
}