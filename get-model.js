'use strict';

var rp = require('request-promise');
const pConfig = require("./public-config");
var {hgetAsync, hsetAsync} = require('./redis-client');
var {searchRank, filterByRank} = require('./src/utils/rank-actions');


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


async function getKbbMakeId({make: craigsMake, year: craigsYear}, {api, version}) {
  var link = 'https://www.kbb.com/Api/'+ api + '/' + version + '/vehicle/v1/Makes?vehicleClass=UsedCar&yearid='+craigsYear;

  var options = {
      uri: link,
      headers: {
        'User-Agent': USER_AGENT
    },
    timeout: 6000
  };

  var body = await rp(options);
  var makes = JSON.parse(body);
  var re = new RegExp('^' + craigsMake + '$', 'i');

  return makes.filter((make) => {
    return re.exec(make.name) !== null;
  })[0].id
}


async function getKbbModels(craigs) {
  var cacheRes = await hgetAsync("kbbModels", craigs.make + "." + craigs.year);
  if(cacheRes !== null) {
    console.log("getKbbModels cache hit: " + cacheRes);
    return JSON.parse(cacheRes);
  }

  var api = await getApi();
  var makeId = await getKbbMakeId(craigs, api);

  var link = 'https://www.kbb.com/Api/'+ api.api + '/' + api.version + '/vehicle/v1/Models?makeid=' + makeId + '&vehicleClass=UsedCar&yearid=' + craigs.year;
  var options = {
      uri: link,
      headers: {
        'User-Agent': USER_AGENT
    },
    timeout: 6000
  };

  var body = await rp(options);
  var models = JSON.parse(body);
  var re = new RegExp(craigs.model, 'i');
  var res = models.map((model) => model.name);

  if(res.length > 0) {
    // Set cache.

    await hsetAsync("kbbModels", craigs.model + "." + craigs.year, JSON.stringify(res));
  }

  return res;
}

async function matchModels(craigs) {
  var models = await getKbbModels(craigs);
  console.log(models);
  models = models.map((m) => {
    return {text: m};
  });
  // First do rank search of the craigsModel.
  var res = filterByRank(searchRank(craigs.model, models, ['-'])).filtered;
  if(res.length > 1) {
    // Try searching the title.
    res = filterByRank(searchRank(craigs.title, res, ['-'])).filtered;
  }

  if(res.length > 1) {
    // Try searching the body.
    res = filterByRank(searchRank(craigs.extra.body, res, ['-'])).filtered;
  }
  console.log(res);
  return res[0].text;
}

// matchModels({make: 'ford', model: 'f-150', year: '2014'});

module.exports = {matchKbbModels: matchModels};
