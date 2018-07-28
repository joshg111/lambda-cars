'use strict';

var redis = require("redis")

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
  const {key} = input;
  console.log("get key", key);
  var rsp = await getAsync(key)
  if(rsp !== null) {
    rsp = JSON.parse(rsp);
  }
  return rsp;
}

function startClient() {
  client = redis.createClient({host: "lambda-redis-small.skzc5i.0001.use1.cache.amazonaws.com"});

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

  // startClient();
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
