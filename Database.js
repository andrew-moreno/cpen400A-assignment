const { MongoClient, ObjectID } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v3.6+ - [API Documentation](http://mongodb.github.io/node-mongodb-native/3.6/api/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen400a app.
 */
function Database(mongoUrl, dbName) {
  if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
  this.connected = new Promise((resolve, reject) => {
    MongoClient.connect(
      mongoUrl,
      {
        useNewUrlParser: true
      },
      (err, client) => {
        if (err) reject(err);
        else {
          console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
          resolve(client.db(dbName));
        }
      }
    )
  });
  this.status = () => this.connected.then(
    db => ({ error: null, url: mongoUrl, db: dbName }),
    err => ({ error: err })
  );
}

Database.prototype.getRooms = function () {
  return this.connected.then(db =>
    new Promise((resolve, reject) => {
      const collection = db.collection("chatrooms");
      var rooms = collection.find();
      rooms.toArray().then((roomsArr) => {
        console.log("getRooms: getting rooms");
        resolve(roomsArr);
      })
    })
  )
}

Database.prototype.getRoom = function (room_id) {
  return this.connected.then(db =>
    new Promise((resolve, reject) => {
      var collection = db.collection("chatrooms");
      var id;
      try {
        id = ObjectID(room_id);
      }
      catch (err) {
        id = room_id;
      }
      var room = collection.findOne({ _id: id });
      if (room) {
        console.log("getRoom: resolving room");
        resolve(room);
      }
      else {
        console.log("getRoom: resolving null");
        resolve(null);
      }

    })
  )
}

Database.prototype.addRoom = function (room) {
  return this.connected.then(db =>
    new Promise((resolve, reject) => {
      console.log("--------addRoom--------");
      if (!room.name) {
        console.log("Rroom argument has no name");
        reject("No name provided.")
      }
      var collection = db.collection("chatrooms");
      var nextId = collection.countDocuments();
      nextId.then((count) => {
        var roomsCount = count + 1;
        var newRoom = {
          _id: "room-" + roomsCount,
          name: room.name,
          image: room.image
        }
        console.log("Inserting new room into collection");
        collection.insertOne(newRoom);
        resolve(newRoom);
      })
    })
  )
}

Database.prototype.getLastConversation = function (room_id, before) {
  return this.connected.then(db =>
    new Promise((resolve, reject) => {
      console.log("--------getLastConversation--------");
      if (before === undefined) {
        before = Date.now();
        console.log("Timestamp set to " + before);
      }
      var collection = db.collection("conversations");
      var query = { room_id: room_id, timestamp: { $lt: parseInt(before) } };
      collection.find(query).toArray((err, result) => {
        console.log("Querying for room_id: " + room_id + " and timestamp<" + before);
        if (err) {
          reject(err);
        }
        if (result) {
          resolve(result[result.length - 1]);
        }
      })
    })
  )
}

Database.prototype.addConversation = function (conversation) {
  return this.connected.then(db =>
    new Promise((resolve, reject) => {
      console.log("--------addConversation--------");
      if (!conversation.room_id || !conversation.timestamp || !conversation.messages) {
        reject("Missing fields in conversation object. ")
      }
      var collection = db.collection("conversations");
      console.log("Inserting conversation");
      collection.insertOne(conversation).then(() => {
        console.log("Resolving conversation");
        resolve(conversation);
      })
    })
  )
}

Database.prototype.getUser = function (username) {
  return this.connected.then(db =>
    new Promise((resolve, reject) => {
      console.log("--------getUser--------");
      var collection = db.collection("users");
      collection.findOne({ username: username }).then((user) => {
        if (user) {
          console.log("Resolving with the user");
          resolve(user)
        }
        else {
          console.log("Resolving null");
          resolve(null);
        }
      })
    })
  )
}

module.exports = Database;