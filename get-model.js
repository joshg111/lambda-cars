'use strict';

var rp = require('request-promise');
const pConfig = require("./public-config");
var {hgetAsync, hsetAsync} = require('./redis-client');
var {searchRank, filterByRank} = require('./src/utils/rank-actions');
var {getRelations} = require('./src/utils/relations');


const OPTIONS = pConfig.rp.OPTIONS;
const USER_AGENT = pConfig.rp.USER_AGENT;

// Get API and dataVersionId
async function getApi() {
  var link = 'https://www.kbb.com/used-cars/';

  var options = {
      uri: link,
      headers: {
        'User-Agent': USER_AGENT
    },
    timeout: 6000
  };

  var api = null;
  var version = null;

  try {
    var body = await rp(options);

    api = /var assemblyVersion = "(.+)"/g.exec(body)[1];
    version = /var dataVersionId = "(.+)"/g.exec(body)[1];
  }
  catch(err) {
    console.log("getApi err = ", err);
    throw new Error(err);
  }

  return ({api, version});
}


async function matchKbbMakeId(craigs, kbb) {
  var link = 'https://www.kbb.com/Api/'+ kbb.extra.api.api + '/' + kbb.extra.api.version + '/vehicle/v1/Makes?vehicleClass=UsedCar&yearid='+craigs.year;

  var options = {
      uri: link,
      headers: {
        'User-Agent': USER_AGENT
    },
    timeout: 6000
  };

  var body = await rp(options);
  var makes = JSON.parse(body);
  var res = makes.map((m) => {
    return {text: m.name, id: m.id};
  });

  res = searchRank([craigs.desc, craigs.title], res, ["word", "findLongestPrefix"]);
  if(res.length > 1) {
    res = searchRank([craigs.extra ? craigs.extra.body : null], res, ["word", "findLongestPrefix"]);
  }

  if(res.length > 1) {
    console.log("Can't determine which make, return null");
    return null;
  }

  var {text: make, id} = res[0];
  return {make, id}
}


async function getKbbModels(craigs, kbb) {
  console.log("getting models");
  var cacheRes = await hgetAsync("kbbModels", kbb.kbbMake + "." + craigs.year);
  if(cacheRes !== null) {
    console.log("getKbbModels cache hit: " + cacheRes);
    return JSON.parse(cacheRes);
  }

  var link = 'https://www.kbb.com/Api/'+ kbb.extra.api.api + '/' + kbb.extra.api.version + '/vehicle/v1/Models?makeid=' + kbb.extra.kbbMakeId + '&vehicleClass=UsedCar&yearid=' + craigs.year;
  var options = {
      uri: link,
      headers: {
        'User-Agent': USER_AGENT
    },
    timeout: 6000
  };

  var body = await rp(options);
  var models = JSON.parse(body);
  var res = models.map((model) => model.name);

  if(res.length > 0) {
    // Set cache.

    await hsetAsync("kbbModels", kbb.kbbMake + "." + craigs.year, JSON.stringify(res));
  }

  return res;
}

async function matchModels(craigs, kbb) {
  var models = await getKbbModels(craigs, kbb);
  var res = models.map((m) => {
    return {text: m};
  });
  console.log("models = ", res);

  res = searchRank([craigs.desc, craigs.title], res, ["word", "findLongestPrefix"]);
  if(res.length > 1) {
    console.log("Model search using body content");
    res = searchRank([craigs.extra ? craigs.extra.body : null], res, ["word", "findLongestPrefix"]);
  }
  console.log("match model = ", res[0].text);
  return res[0].text;
}

// matchModels({make: 'ford', model: 'f-150', year: '2014'});

module.exports = {matchKbbModels: matchModels, matchKbbMake: matchKbbMakeId, getApi};
