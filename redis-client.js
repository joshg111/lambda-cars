'use strict';

var redis = require("redis");
const config = require("./config");

var client;
var getAsync;
var setAsync;

if (typeof client === 'undefined') {
  console.log("Client undefined");
  startClient();
}
else if(!client.connected) {
  console.log("Client not connected");
  startClient();
}

async function set(input) {
  const {key, value} = input;
  console.log("set key", key);

  var rsp = await setAsync(key, JSON.stringify(value), 'EX', 24*60*60);

};

async function get(input) {
  try {
    const {key} = input;
    console.log("get key", key);
    var rsp = await getAsync(key)
    if(rsp !== null) {
      rsp = JSON.parse(rsp);
    }
  }
  catch(err) {
    console.log("Failed redis get for input = ", key);
  }

  return rsp;
}

function startClient() {
  client = redis.createClient(
    {
      host: config.redis.HOST,
      port: config.redis.PORT,
      password: config.redis.PASSWORD
    });

  client.on("error", function (err) {
      console.log("Error " + err);
  });

  client.on("ready", function () {
      console.log("Ready, for redis client");
  });

  const {promisify} = require('util');
  getAsync = promisify(client.get).bind(client);
  setAsync = promisify(client.set).bind(client);
}

async function requestCache(action, input) {

  var res = null;

  console.log("action", action);
  console.log("input", input);

  if(action === "set") {
    await set(input);
  }
  else if(action === "get") {
    res = await get(input);

  }

  return res;

};

module.exports = {requestCache};

// requestCache("get", {key: "hi"}).then((rsp) => {
//   console.log(rsp);
// });
