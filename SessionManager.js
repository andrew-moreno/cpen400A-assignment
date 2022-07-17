const crypto = require('crypto');
const Database = require('./Database');

class SessionError extends Error { };

function SessionManager() {
  // default session length - you might want to
  // set this to something small during development
  const CookieMaxAgeMs = 600000;

  // keeping the session data inside a closure to keep them protected
  const sessions = {};

  // might be worth thinking about why we create these functions
  // as anonymous functions (per each instance) and not as prototype methods
  this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
    console.log("----------createSession----------");
    var token = crypto.randomBytes(64).toString("hex");
    var tokenCreationTime = Date.now();
    var tokenExpiry = tokenCreationTime + maxAge;
    console.log("Token created at: " + tokenCreationTime);
    console.log("Token expires at: " + tokenExpiry);
    var object = {
      username: username,
      timestamp: tokenCreationTime,
      expiry: tokenExpiry
    }
    sessions[token] = object;
    console.log("Created session: ");
    console.log(token + ":");
    console.log(sessions[token]);
    var timeoutHandler = function () {
      return function () {
        delete sessions[token];
        console.log("Session emptied");
      }
    }
    setTimeout(timeoutHandler(), maxAge);
    if (response) {
      response.cookie("cpen400a-session", token, { maxAge: maxAge });
    };
  };

  this.deleteSession = (request) => {
    console.log("----------deleteSession----------");
    delete sessions[request.session];
    delete request.username;
    delete request.session;
  };

  this.middleware = (request, response, next) => {
    console.log("----------middleware----------");
    var cookie = request.headers.cookie;
    console.log("Cookie: " + cookie);
    if (cookie == null || cookie == undefined) {
      console.log("No cookie");
      next(new SessionError("No cookie"));
      return;
    }

    var token = cookie.split("cpen400a-session=").pop();
    var token = token.split("; ")[0]
    console.log("Token: " + token);
    if (sessions[token] == null || sessions[token] == undefined) {
      console.log("Token not found in sessions object");
      next(new SessionError("Token not found in sessions object"));
      return;
    }
    console.log("sessions[token].username: ");
    console.log(sessions[token]);
    request.username = sessions[token].username;
    request.session = token;
    next();
  };



  // this function is used by the test script.
  // you can use it if you want.
  this.getUsername = (token) => ((token in sessions) ? sessions[token].username : null);
};

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;