'use strict';

var redis = require("redis")

var client;
var getAsync;
var setAsync;

if (typeof client === 'undefined') {
  console.log("client undefined");
  startClient();
}

async function set(input) {
  const {key, value} = input;
  console.log("key", key);

  var rsp = await setAsync(key, JSON.stringify(value), 'EX', 24*60*60);
  console.log("rsp", rsp);

};

async function get(input) {
  const {key} = input;
  console.log("get key", key);
  var rsp = await getAsync(key)
  console.log("rsp", rsp);
  return rsp;
}

function startClient() {
  client = redis.createClient({host: "lambda-redis-small.skzc5i.0001.use1.cache.amazonaws.com"});

  client.on("error", function (err) {
      console.log("Error " + err);
  });

  const {promisify} = require('util');
  getAsync = promisify(client.get).bind(client);
  setAsync = promisify(client.set).bind(client);
}

module.exports.hello = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // startClient();

  console.log("event", event);
  var {action, input} = JSON.parse(event.body);
  console.log("action", action);
  console.log("input", input);

  const rr = {
    statusCode: 200,
    body: JSON.stringify({
      status: 'success'
    }),
  };

  if(action === "set") {
    await set(input);
  }
  else if(action === "get") {
    var res = await get(input);
    rr.body = JSON.stringify({status: 'success',
      res
    })
  }

  // client.quit();

  callback(null, rr);

};
