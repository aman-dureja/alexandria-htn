var express = require('express')
var app = express();
var firebase = require('firebase');
var twilio = require('twilio');
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({extended: false}));

var accountSid = 'AC689a075944a69e1bedcb582029dca896';
var authToken = 'd9a63d580ef1e7067eec995443a8c6b5';

var client = new twilio.RestClient(accountSid, authToken);

app.use(function (req, res, next) {
  console.log('REQUESTS ARE BEING MADE!');
  next();
});

var config = {
	apiKey: "AIzaSyD_QqXPNLnKROWdQOttuR4ODbGxtdXgIpU",
    authDomain: "alexandria-c0235.firebaseapp.com",
    databaseURL: "https://alexandria-c0235.firebaseio.com",
    storageBucket: "alexandria-c0235.appspot.com",
    messagingSenderId: "590924027925"
};
firebase.initializeApp(config);

function sendMessage(phoneNumber, body) {
	client.messages.create({
		body: body,
		to: phoneNumber,
		from: '+12267804047'
	}, function(err, message) {
		console.log(err||message);
	});
}

function createNewUser(phoneNumber, book) {
  firebase.database().ref('users').push({
    phoneNumber: phoneNumber,
    book: book,
    curSnippet: 0
  });
  var db = firebase.database();
  var ref = db.ref('phonenumbers');
  ref.push(phoneNumber);
  // send a welcome message
  sendMessage(phoneNumber, 'Welcome to Alexandria. We hope you enjoy it!\nText "help" any time for assistance. Happy reading!');
  // send the first snippet
  firebase.database().ref('users').once('value').then(function(snapshot) {
  	var users = snapshot.val();
  	for (key in users) {
  		if (users[key].phoneNumber === phoneNumber) {
  			sendNextSnippet(firebase.database().ref('users/'+key));
  			break;
  		}
  	}
  }).catch(function(err) {
  	console.log(err);
  });
}

function sendNextSnippet(userRef) {
	userRef.once('value').then(function(snapshot) {
		var message = '';
		var user = snapshot.val();
		var phoneNumber = user.phoneNumber;
		var curBook = user.book;
		var curSnippet = user.curSnippet;
		var booksRef = firebase.database().ref('books')
		booksRef.once('value').then(function(bookSnapshot) {
			var books = bookSnapshot.val();
			for (key in books) {
				if (books[key].title.toLowerCase() === curBook.toLowerCase()) {
					var snippetsRef = firebase.database().ref('books/'+key+'/snippets');
					snippetsRef.once('value').then(function(snippetsSnapshot) {
						var snippets = snippetsSnapshot.val();
						if (Object.keys(snippets).length > curSnippet++) {
							message = snippets[curSnippet];
							userRef.update({
								curSnippet: curSnippet
							});
						} else {
							message = 'Congratulations! You have reached the end of the book! To start a new book, just text the title to us!';
						}
						sendMessage(phoneNumber, message);
					}).catch(function(err) {
						console.log(err);
					});
					break;
				}
			}
		}).catch(function(err) {
			console.log(err);
		});
	}).catch(function(err) {
		console.log(err);
	});
}

function parseMessage(phoneNumber, message) {
	if (message.toLowerCase() === 'stop') {
		var usersRef = firebase.database().ref('users');
		usersRef.once('value').then(function(snapshot) {
			var users = snapshot.val();
			for (key in users) {
				if (users[key].phoneNumber === phoneNumber) {
					var userRef = firebase.database().ref('users/'+key);
					userRef.update({
						book: 'Unsubscribed',
						curSnippet: 1
					});
				}
			}
		}).catch(function(err) {
			console.log(err);
		});
	} else if (message.toLowerCase() === 'next') {
		var usersRef = firebase.database().ref('users');
		usersRef.once('value').then(function(snapshot) {
			var users = snapshot.val();
			for (key in users) {
				if (users[key].phoneNumber === phoneNumber) {
					var userRef = firebase.database().ref('users/'+key);
					sendNextSnippet(userRef);
				}
			}
		}).catch(function(err) {
			console.log(err);
		})
	} else if (message) {
		// message is probably a title of a book
		// if the user already exists, we change their book and curSnippet
		// else we create the user with the new book
		var phonesRef = firebase.database().ref('phonenumbers');
		phonesRef.once('value').then(function(snapshot) {
			var phoneNumbers = snapshot.val();
			var userExists = false;
			var bookExists = false;
			for (key in phoneNumbers) {
				if (phoneNumbers[key] === phoneNumber) {
					userExists = true;
				}
			}
			firebase.database().ref('books').once('value').then(function(snapshot) {
				var books = snapshot.val();
				for (key in books) {
					console.log(books[key]);
					if (books[key].title.toLowerCase() === message.toLowerCase()) {
						bookExists = true;
						break;
					}
				}
				if (bookExists) {
					if (userExists) {
						firebase.database().ref('users').once('value').then(function(snapshot) {
							var users = snapshot.val();
							for (key in users) {
								if (users[key].phoneNumber === phoneNumber) {
									firebase.database().ref('users/'+key).update({
										book: message,
										curSnippet: 0
									});
									sendNextSnippet(firebase.database().ref('users/'+key));
									break;
								}
							}
						}).catch(function(err) {
							console.log(err);
						});
					} else {
						createNewUser(phoneNumber, message);
					}
				} else {
					sendMessage(phoneNumber, 'Sorry, that was either an invalid command or we don\'t have that book in our library. Text "help" any time for assistance!');
				}
			}).catch(function(err) {
				console.log(err);
			});
		}).catch(function(err) {
			console.log(err);
		});
	}
}

function gotPhoneNumber(phoneNumber, message) {
	parseMessage(phoneNumber, message);
}

app.post('/twilio-incoming', function(req, res) {
	gotPhoneNumber(req.body.From, req.body.Body);
});

app.listen(8080);
console.log('THINGS ARE HAPPENING!');