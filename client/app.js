var profile = {
  username: "Andy"
}


var indexHTML = `<div class="content">
  <ul class="room-list">
    <li>
      <a href="#/chat">meme team 6</a>
    </li>
    <li>
      <a href="#/chat">womps</a>
    </li>
    <li>
      <a href="#/chat">ryan wood fan club</a>
    </li>
  </ul>
  <div class="page-control">
    <input type="text" placeholder="Room Title">
    <button>Create Room</button>
  </div>
</div>`

var chatHTML = `<div class="content">
  <h4 class="room-name">ROOM 1</h4>
  <div class="message-list">
    <div class="message">
      <span class="message-user">Andy</span>
      <span class="message-text">Hey how's it going</span>
    </div>
    <div class="message my-message">
      <span class="message-user">Androo</span>
      <span class="message-text">I'm good yo</span>
    </div>
    <div class="message">
      <span class="message-user">Andy</span>
      <span class="message-text">Hey how's it going</span>
    </div>
    <div class="message my-message">
      <span class="message-user">Andy</span>
      <span class="message-text">Hey how's it going</span>
    </div>
  </div>
  <div class="page-control">
    <textarea placeholder="Message"></textarea>
    <button>Send</button>
  </div>
</div>`

var profileHTML = `<div class="content">
  <div class="profile-form">
    <div class="form-field">
      <label for="">Username</label>
      <input type="text">
    </div>
    <div class="form-field">
      <label for="">Password</label>
      <input type="password">
    </div>
    <div class="form-field">
      <label for="">Avatar Image</label>
      <input type="file">
    </div>
  </div>
  <div class="page-control">
    <button>Save</button>
  </div>
</div>`

var Service = {
  origin: window.location.origin,
  getAllRooms: function () {
    return new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", Service.origin + "/chat");
      xhr.onload = function () {
        if (xhr.status == 200) {
          resolve(JSON.parse(xhr.responseText));
        }
        else {
          reject(new Error(xhr.responseText));
        }
      }
      xhr.onabort = function () {
        reject(new Error("Request aborted."));
      }
      xhr.timeout = 200;
      xhr.timeout = function () {
        reject(new Error("Request timed out."));
      }
      xhr.onerror = function () {
        reject(new Error("Error with request."));
      }
      xhr.send();
    })
  },

  addRoom: function (data) {
    return new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", Service.origin + "/chat");
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.onload = function () {
        if (xhr.status == 200) {
          console.log("Request successful");
          resolve(JSON.parse(xhr.responseText));
        }
        else {
          reject(new Error(xhr.responseText));
        }
      }
      xhr.onabort = function () {
        reject(new Error("Request aborted."));
      }
      xhr.timeout = 200;
      xhr.timeout = function () {
        reject(new Error("Request timed out."));
      }
      xhr.onerror = function () {
        reject(new Error("Error with request."));
      }
      console.log(data)
      xhr.send(JSON.stringify(data));
    })
  },

  getLastConversation: function (room_id, before) {
    return new Promise((resolve, reject) => {
      console.log("----------Service.getLastConversation----------");
      var xhr = new XMLHttpRequest();
      xhr.open("GET", Service.origin + "/chat/" + room_id + "/messages?before=" + encodeURIComponent(before), true);
      xhr.onload = function () {
        if (xhr.status == 200) {
          console.log("Response text: " + xhr.responseText);
          resolve(JSON.parse(xhr.responseText));
        }
        else {
          reject(new Error(xhr.responseText));
        }
      }
      xhr.onabort = function () {
        reject(new Error("Request aborted."));
      }
      xhr.timeout = 200;
      xhr.timeout = function () {
        reject(new Error("Request timed out."));
      }
      xhr.onerror = function () {
        reject(new Error("Error with request."));
      }
      xhr.send();
    })
  },

  getProfile: function () {
    return new Promise((resolve, reject) => {
      console.log("----------Service.getProfile----------");
      var xhr = new XMLHttpRequest();
      xhr.open("GET", Service.origin + "/profile");
      xhr.onload = function () {
        if (xhr.status == 200) {
          resolve(JSON.parse(xhr.responseText));
        }
        else {
          reject(new Error(xhr.responseText));
        }
      }
      xhr.onabort = function () {
        reject(new Error("Request aborted."));
      }
      xhr.timeout = 200;
      xhr.timeout = function () {
        reject(new Error("Request timed out."));
      }
      xhr.onerror = function () {
        reject(new Error("Error with request."));
      }
      xhr.send();
    })
  }
}

// Removes the contents of the given DOM element (equivalent to elem.innerHTML = '' but faster)
function emptyDOM(elem) {
  while (elem.firstChild) elem.removeChild(elem.firstChild);
}

// Creates a DOM element from the given HTML string
function createDOM(htmlString) {
  let template = document.createElement('template');
  htmlString.trim();
  template.innerHTML = htmlString;
  return template.content.firstChild;
}

function* makeConversationLoader(room) {
  var lastTimeStamp = room.timeCreated;
  console.log(lastTimeStamp);
  while (lastTimeStamp > 0 && room.canLoadConversation == true) {
    yield new Promise((resolve, reject) => {
      room.canLoadConversation = false;
      var lastConvo = Service.getLastConversation(room.id, lastTimeStamp)
      lastConvo.then((convo) => {
        console.log("Convo: ");
        console.log(convo);
        if (convo) {
          lastTimeStamp = convo.timestamp;
          room.canLoadConversation = true;
          room.addConversation(convo);
          resolve(convo);
        }
        else {
          resolve(null);
        }
      })
    })
  }
}

window.addEventListener("load", main, false);

function main() {
  var lobby = new Lobby();
  var lobbyView = new LobbyView(lobby);
  var socket = new WebSocket("ws://localhost:8000");
  var chatView = new ChatView(socket);
  var profileView = new ProfileView();

  var pageView = document.getElementById("page-view");
  window.addEventListener("popstate", renderRoute, false);

  socket.addEventListener("message", function (event) {
    var message = JSON.parse(event.data);
    var roomId = message.roomId
    var messageText = message.text;
    var messageUsername = message.username;
    // XSS prevention
    var cleanMessageText = messageText
      // .replace(/&/g, "&amp;")
      //.replace(/"/g, "\"")
      // .replace(/'/g, "&#x27;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
    console.log("Dirty message: " + messageText);
    console.log("Clean message: " + cleanMessageText);

    var room = lobby.getRoom(roomId);
    room.addMessage(messageUsername, cleanMessageText);
    console.log("Message added");
  });

  function renderRoute() {
    var url = window.location.hash;
    if (url == "#/") {
      emptyDOM(pageView);
      pageView.appendChild(lobbyView.elem);
      console.log("Lobby loaded");
    }
    else if (url.startsWith("#/chat")) {
      emptyDOM(pageView);
      pageView.appendChild(chatView.elem);
      var room = lobby.getRoom(url.split("#/chat/")[1]);
      if (room != undefined && room != null) {
        chatView.setRoom(room);
      }
      console.log("Chat room loaded");
    }
    else if (url == "#/profile") {
      emptyDOM(pageView);
      pageView.appendChild(profileView.elem);
      console.log("Profile loaded");
    }
    else {
      console.log("Invalid url")
    };
  }

  function refreshLobby() {
    Service.getAllRooms()
      .then((result) => {
        //console.log("RefreshLobby result: " + result)
        var roomKeys = Object.keys(lobby.rooms);
        var roomSet = new Set();
        for (var i = 0; i < roomKeys.length; i++) {
          roomSet.add(roomKeys[i]);
        }
        for (var i = 0; i < result.length; i++) {
          //console.log("Refreshing lobby: " + result[i].id + " with " + roomKeys[i]);
          if (roomSet.has(result[i]._id)) {
            lobby.rooms[roomKeys[i]].name = result[i].name;
            lobby.rooms[roomKeys[i]].image = result[i].image;
          }
          else {
            lobby.addRoom(result[i]._id, result[i].name, result[i].image, result[i].messages);
          }
        }
      })
  }

  renderRoute();
  refreshLobby();

  Service.getProfile().then((newProfile) => {
    console.log("Profile: " + newProfile.username);
    profile = newProfile;
  })


  setInterval(refreshLobby, 5000);
  cpen400a.setDefault("testRoomId", 'room-1');
  cpen400a.setDefault("cookieName", 'cpen400a-session');
  cpen400a.setDefault("testUser1", { username: 'alice', password: 'secret', saltedHash: '1htYvJoddV8mLxq3h7C26/RH2NPMeTDxHIxWn49M/G0wxqh/7Y3cM+kB1Wdjr4I=' });
  cpen400a.setDefault("testUser2", { username: 'bob', password: 'password', saltedHash: 'MIYB5u3dFYipaBtCYd9fyhhanQkuW4RkoRTUDLYtwd/IjQvYBgMHL+eoZi3Rzhw=' });
  cpen400a.setDefault("image", 'assets/everyone-icon.png');
  cpen400a.setDefault("webSocketServer", 'ws://localhost:8000');
  //for testing script
  cpen400a.export(arguments.callee, { lobby, chatView });

}

var Lobby = function () {
  this.rooms = {};
};

Lobby.prototype.getRoom = function (roomId) {
  for (var room in this.rooms) {
    if (room == roomId) {
      return this.rooms[room];
    }
  }
};

Lobby.prototype.addRoom = function (id, name, image, messages) {
  var room = new Room(id, name, image, messages);
  this.rooms[id] = room;
  if (typeof this.onNewRoom !== "undefined") {
    this.onNewRoom(room);
  };
  console.log(this.rooms);
};

var Room = function (id, name, image = "assets/everyone-icon.png", messages = []) {
  this.id = id;
  this.name = name;
  this.image = image;
  this.messages = messages;
  this.timeCreated = Date.now();
  this.getLastConversation = makeConversationLoader(this);
  this.canLoadConversation = true;
}

Room.prototype.addMessage = function (username, text) {
  if (text == "") {
    return;
  }
  newMessage = {
    username: username,
    text: text
  };
  this.messages.push(newMessage);
  if (typeof this.onNewMessage != "undefined") {
    this.onNewMessage(newMessage)
  }
};

Room.prototype.addConversation = function (conversation) {
  for (var i = 0; i < conversation.messages.length; i++) {
    this.messages.push(conversation.messages[i]);
  }
  console.log(this.messages);
  console.log(conversation.messages);
  this.onFetchConversation(conversation)
}

var LobbyView = function (lobby) {
  this.lobby = lobby;
  this.elem = createDOM(indexHTML);
  this.listElem = this.elem.querySelector("ul.room-list");
  this.inputElem = this.elem.querySelector("input");
  this.buttonElem = this.elem.querySelector("button");
  var self = this;

  function addRoom() {
    var roomName = self.inputElem.value;
    var data = { name: roomName };
    if (roomName == "" || roomName.indexOf(" ") >= 0) {
      return;
    }
    Service.addRoom(data)
      .then((result) => {
        self.lobby.addRoom(result._id, result.name, result.image);
      })
    self.inputElem.value = "";
  }
  this.buttonElem.addEventListener("click", function () {
    addRoom();
  }, false); // TODO: copy to below handler
  this.inputElem.addEventListener("keyup", function (key) {
    if (key.key == "Enter") {
      addRoom();
    }
  }, false);

  this.redrawList();

  this.lobby.onNewRoom = function (room) {
    var list = document.createElement("li");
    var aTag = document.createElement("a");
    aTag.href = "#/chat/" + room.id;
    aTag.innerText = room.name;
    list.appendChild(aTag);
    self.listElem.appendChild(list);
  }
}

LobbyView.prototype.redrawList = function () {
  emptyDOM(this.listElem);
  for (var room in this.lobby.rooms) {
    var list = document.createElement("li");
    var aTag = document.createElement("a");
    aTag.href = "#/chat/" + room;
    aTag.innerText = this.lobby.rooms[room].name;
    list.appendChild(aTag);
    this.listElem.appendChild(list);
  };
};

var ChatView = function (socket) {
  this.elem = createDOM(chatHTML);
  this.titleElem = this.elem.querySelector(".room-name");
  this.chatElem = this.elem.querySelector("div.message-list");
  this.inputElem = this.elem.querySelector("textarea");
  this.buttonElem = this.elem.querySelector("button");
  this.room = null;
  this.socket = socket;
  var self = this;

  this.buttonElem.addEventListener("click", function () {
    self.sendMessage();
  }, false);
  this.inputElem.addEventListener("keyup", function (key) {
    if (key.key == "Enter" && !key.shiftKey) {
      self.sendMessage();
    }
  }, false);
  this.chatElem.addEventListener("wheel", function (event) {
    if (self.room.canLoadConversation == true
      && self.chatElem.scrollTop == 0 && event.deltaY < 0) {
      self.room.getLastConversation.next();
    }
  }, false);
}
ChatView.prototype.setRoom = function (room) {
  this.room = room;
  this.titleElem.innerText = this.room.name;
  var self = this;

  emptyDOM(this.chatElem);
  var messages = this.room.messages;
  for (var message in messages) {
    var div = document.createElement("div");
    if (messages[message].username == profile.username) {
      div.className = "message my-message";
    }
    else {
      div.className = "message";
    }
    var username = document.createElement("span");
    username.className = "message-user";
    username.innerText = messages[message].username;

    var text = document.createElement("span");
    text.className = "message-text";
    text.innerText = messages[message].text;

    div.appendChild(username);
    div.appendChild(text);
    this.chatElem.appendChild(div);
  }

  this.room.onNewMessage = function (message) {
    var container = document.createElement("div");
    if (message.username == profile.username) {
      container.className = "message my-message";
    }
    else {
      container.className = "message";
    }
    var username = document.createElement("span");
    username.className = "message-user";
    username.innerText = message.username;

    var text = document.createElement("span");
    text.className = "message-text";
    if (typeof message.text == "string") {
      text.innerText = message.text;
    }
    container.appendChild(username);
    container.appendChild(text);
    console.log(text);
    self.chatElem.appendChild(container);
  }
  this.room.onFetchConversation = function (conversation) {
    console.log("----------onFetchConversation----------");
    var messages = conversation.messages
    console.log("Message: ");
    console.log(messages);
    var oldScrollHeight = self.chatElem.scrollHeight;
    for (var i = messages.length - 1; i >= 0; i--) {
      var container = document.createElement("div");
      if (messages[i].username == profile.username) {
        container.className = "message my-message";
      }
      else {
        container.className = "message";
      }
      var username = document.createElement("span");
      username.className = "message-user";
      username.innerText = messages[i].username;

      var text = document.createElement("span");
      text.className = "message-text";
      if (typeof messages[i].text == "string") {
        text.innerText = messages[i].text;
      }
      container.appendChild(username);
      container.appendChild(text);
      self.chatElem.insertBefore(container, self.chatElem.firstChild);
    }
    var newScrollHeight = self.chatElem.scrollHeight;
    self.chatElem.scrollTo(0, newScrollHeight - oldScrollHeight)
  }
}

ChatView.prototype.sendMessage = function () {
  var text = this.inputElem.value;
  if (typeof text == "string") {
    var message = {
      roomId: this.room.id,
      text: text
    };
    this.room.addMessage(profile.username, text);
    this.socket.send(JSON.stringify(message))
    console.log(message);
  }
  this.inputElem.value = "";
};

var ProfileView = function () {
  this.elem = createDOM(profileHTML);
}





