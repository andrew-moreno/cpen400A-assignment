// assuming cpen400a-tester.js is in the same directory as server.js
const cpen400a = require('./cpen400a-tester.js');
const path = require('path');
const fs = require('fs');
const express = require('express');
const ws = require('ws');
const crypto = require('crypto');

const Database = require('./Database.js');
const SessionManager = require('./SessionManager.js');
const db = new Database('mongodb://localhost:27017', 'cpen400a-messenger')
const sessionManager = new SessionManager();


function logRequest(req, res, next) {
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

function isCorrectPassword(password, saltedHash) {
	console.log("----------isCorrectPassword----------");
	var salt = saltedHash.substring(0, 20);
	var saltedPassword = password + salt;
	var digestedSaltedPassword = crypto.createHash("sha256")
		.update(saltedPassword)
		.digest("base64")
	var saltedHashCopy = salt + digestedSaltedPassword;

	console.log("Password: " + password);
	console.log("Salted hash: " + saltedHash);
	console.log("Salt: " + salt);
	console.log("Salted password: " + saltedPassword);
	console.log("Digested password: " + digestedSaltedPassword);
	console.log("Copy of saltedHash: " + saltedHashCopy);

	if (saltedHash == saltedHashCopy) {
		return true;
	}
	return false;
}




const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');
const broker = new ws.Server({ port: 8000 });
const messageBlockSize = 10;

var msgContainer = [];
broker.on('connection', function connection(event, incomingMessage) {
	console.log("Connection event");
	var cookie = incomingMessage.headers.cookie;
	if (cookie == "undefined" || cookie == undefined) {
		event.close();
		return;
	}

	var token = cookie.split("cpen400a-session=").pop();
	var sessionUsername = sessionManager.getUsername(token);
	if (sessionUsername == null) { // checks if the token is invalid
		event.close();
		return;
	}

	event.on('message', function incoming(data) {
		console.log("Messsage event");
		var msgData = {};
		var message = JSON.parse(data);
		var messageText = message.text;
		message.username = sessionUsername;
		console.log("Session username: " + sessionUsername);
		//XSS Protection
		var cleanMessageText = messageText
			// .replace(/&/g, "&amp;")
			//.replace(/"/g, "\"")
			// .replace(/'/g, "&#x27;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
		message.text = cleanMessageText;
		console.log(cleanMessageText);

		msgData["username"] = sessionUsername;
		msgData["text"] = cleanMessageText;
		msgContainer.push(msgData);
		messages[message.roomId] = msgContainer;
		if (messages[message.roomId].length == messageBlockSize) {
			var conversation = {
				room_id: message.roomId,
				timestamp: Date.now(),
				messages: msgContainer
			}
			console.log("New conversation: ");
			console.log(conversation);
			db.addConversation(conversation);
			messages[message.roomId] = [];
		}
		broker.clients.forEach(function each(client) {
			if (client !== event && client.readyState === ws.OPEN) {
				client.send(JSON.stringify(message));
			}
		});
	});
});

var messages = {};
db.getRooms().then((rooms) => {
	for (var i = 0; i < rooms.length; i++) {
		messages[rooms[i]._id] = [];
	}
})

// express app
let app = express();

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug

app.route("/chat/:room_id/messages")
	.all(sessionManager.middleware)
	.get(function (req, res) {
		console.log("----------get /chat/:room_id/messages----------");
		var room_id = req.params.room_id;
		var before = req.query.before;
		db.getLastConversation(room_id, before).then((convo) => {
			console.log("Conversation: ");
			console.log(convo);
			res.send(convo);
		})
	})

app.route("/chat/:room_id")
	.all(sessionManager.middleware)
	.get(function (req, res) {
		console.log("----------get /chat/:room_id----------");
		var room_id = req.params.room_id;
		db.getRoom(room_id).then((room) => {
			console.log(room);
			if (room) res.send(room);
			else res.status(404).send(req.params.room_id + " was not found.")
		})
	})

app.route("/chat")
	.all(sessionManager.middleware)
	.get(function (req, res, next) {
		console.log("----------get /chat----------");
		db.getRooms().then((rooms) => {
			var chats = [];
			for (var i = 0; i < rooms.length; i++) {
				chats.push({
					_id: rooms[i]._id,
					name: rooms[i].name,
					image: rooms[i].image,
					messages: messages[rooms[i]._id],
				})
			}
			//console.log(chats);
			res.send(chats);
		})
	})
	.post(function (req, res, next) {
		console.log("----------post /chat/:room_id----------");
		if (req.body.name) {
			db.addRoom(req.body).then((room) => {
				messages[room._id] = [];
				res.status(200).send(room);
			})
		}
		else {
			res.status(400).send("Name field not included.");
		}
	})

app.route("/profile")
	.all(sessionManager.middleware)
	.get(function (req, res, next) {
		console.log("----------get /profile----------");
		var object = {
			username: req.username
		}
		console.log(object);
		res.send(object);
	})

app.route("/logout")
	.get(function (req, res, next) {
		console.log("----------get /logout----------");
		sessionManager.deleteSession(req);
		res.redirect("/login");
	})

app.use("/app.js", sessionManager.middleware, express.static(clientApp + "/app.js"));
app.use("/index.html", sessionManager.middleware, express.static(clientApp + "/index.html"));
app.use("/index", sessionManager.middleware, express.static(clientApp + "/index.html"));
app.use(/^\/$/, sessionManager.middleware);

// serve static files (client-side)
app.use("/", express.static(clientApp, { extensions: ['html'] }));
app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

app.use(function middlewareErrorHandler(err, req, res, next) {
	console.log("----------middlewareErrorHandler----------");
	if (err instanceof SessionManager.Error) {
		var accept = req.headers.accept;
		console.log("Accept header: " + accept);
		if (accept == "application/json") {
			res.status(401).send(err);
		} else {
			res.redirect("/login");
		}
	}
	else {
		console.log("Returning HTTP 500");
		res.status(500).send("Ruhroh")
	}
})

app.route("/login").post(function (req, res) {
	console.log("----------post /login----------");
	var username = req.body.username;
	var userPassword = req.body.password;
	console.log("Username: " + username);
	console.log("Password: " + userPassword);
	db.getUser(username).then((user) => {
		if (!user) {
			console.log("No user with specified username");
			res.status(404).redirect("/login");
			return;
		}
		var saltedHash = user.password
		if (!isCorrectPassword(userPassword, saltedHash)) {
			console.log("Incorrect password");
			res.redirect("/login");
			return;
		}
		sessionManager.createSession(res, username);
		res.status(200).redirect("/");
	})
})

// at the very end of server.js
cpen400a.connect('http://35.183.65.155/cpen400a/test-a5-server.js');
cpen400a.export(__filename, { app, db, messages, messageBlockSize, sessionManager, isCorrectPassword });


