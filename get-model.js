'use strict';

var rp = require('request-promise');
const pConfig = require("./public-config");
const config = require("./config");
var {hgetAsync, hsetAsync} = require('./redis-client');
var {searchRank, filterByRank, fuseSearch} = require('./src/utils/rank-actions');
var {getRelations} = require('./src/utils/relations');
var {Source} = require('./src/rank/source');


const OPTIONS = pConfig.rp.OPTIONS;
const USER_AGENT = pConfig.rp.USER_AGENT;
const GO_CRAIGS_URI = config.gocraigs.URI;

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

async function matchKbbMakeId(craigs, sources) {
    let startTime = new Date();
    var cacheRes = await hgetAsync("kbbMakes", craigs.year);
    var makes = JSON.parse(cacheRes);
    var internalMakes = {};
    makes = makes.map((m) => {
      return {name: m.name, id: m.id.toString()};
    })
    makes.forEach((m) => {
      internalMakes[m.id] = {make: m.name}
    });
    var res = makes.map((m) => {
        var text = m.name.replace(/-/, ' ');
        return {text, key: m.id};
    });

    var externalSources = sources.map((s) => {
      return s.toString()
    })

    var body = {targets: res, sources: externalSources};

    var options = {
      uri: GO_CRAIGS_URI,
      headers: {
        'User-Agent': USER_AGENT
      },
      method: 'POST',
      json: true,
      timeout: 6000,
      body: body
    };

    var rankedTarget = await rp(options);

    var key = rankedTarget.target.key;

    return {...internalMakes[key], id: key};


    // res = searchRank(sources, res, ["insequenceCount"]);
    // if (res.length > 1 && craigs.extra) {
    //     res = searchRank([new Source(craigs.extra.body)], res, ["word", "findLongestPrefix"]);
    // }

    // if (res.length > 1) {
    //     console.log("Can't determine which make, return null");
    //     return null;
    // }

    // var {make, id, match} = res[0];
    // console.log("matchKbbMakeId: ", new Date() - startTime);
    // return {make, id, match}
}


async function getKbbModels(craigs, kbb) {
  var cacheRes = await hgetAsync("kbbCarData", craigs.year + "." + kbb.kbbMake.toLowerCase());
  if(cacheRes !== null) {
    var models = JSON.parse(cacheRes);
    for(var model of models) {
      model.model = model.model.replace(/-/, ' ');
      model.styleText = model.styleText.replace(/-/, ' ');
    }

    var internalModels = {};
    models.forEach((model) => {
      model.model = model.model.replace(/-/, ' ');
      model.styleText = model.styleText.replace(/-/, ' ');
      internalModels[model.href] = {model: model.model, styleText: model.styleText};
    })

    var externalModels = Object.keys(internalModels).reduce((result, key) => {
      var model = internalModels[key];
      result.push({text: model.model + " " + model.styleText, key});
      return result;
    }, [])
    
    return {externalModels, internalModels};
  }

  return null;
}

async function matchModelsAndStyle(craigs, kbb, sources) {
    let startTime = new Date();
    var {externalModels, internalModels} = await getKbbModels(craigs, kbb);
    console.log("matchModelsAndStyle after getKbbModels: ", startTime, new Date() - startTime);

    var externalSources = sources.map((s) => {
      return s.toString()
    })

    var body = {targets: externalModels, sources: externalSources};
    // console.log(JSON.stringify(body));

    var options = {
      uri: GO_CRAIGS_URI,
      headers: {
        'User-Agent': USER_AGENT
      },
      method: 'POST',
      json: true,
      timeout: 6000,
      body: body
    };

    var rankedTarget = await rp(options);

    var key = rankedTarget.target.key;

    return {...internalModels[key], href: key};

    // let res = searchRank(
    //     sources,
    //     models,
    //     ["insequenceCount"],
    //     ["model", "styleText"]);

    // console.log("matchModelsAndStyle after searchRank: ", startTime, new Date() - startTime);

    // if(res.length > 1) {
    //     res = searchRank(
    //         [new Source('Sedan')],
    //         res,
    //         ["insequenceCount"],
    //         ["styleText"]);
    // }

    // if (res.length > 1) {
    //     res[0]["isStyleMatch"] = false;
    // }
    // else {
    //     res[0]["isStyleMatch"] = true;
    // }
    // console.log("after model result");
    // // console.log("match model = ", res[0]);
    // var time = new Date() - startTime;
    // console.log("matchModelsAndStyle: ", startTime, new Date() - startTime);
    // if (time > 5000) {
    //   console.log("craigs", craigs);
    // }
    // return res[0];
}

// matchModelsAndStyle({desc: "F350 Super Duty Super Cab XLT Pickup 4D 6 3/4 ft", year: '2014'}, {kbbMake: 'ford'});

module.exports = {matchModelsAndStyle, matchKbbMake: matchKbbMakeId, getApi};
