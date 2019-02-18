'use strict';

var rp = require('request-promise');
const pConfig = require("./public-config");
var {hgetAsync, hsetAsync} = require('./redis-client');
var {searchRank, filterByRank, fuseSearch} = require('./src/utils/rank-actions');
var {getRelations} = require('./src/utils/relations');
var {Source} = require('./src/rank/source');


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

async function matchKbbMakeId(craigs, sources) {
    var cacheRes = await hgetAsync("kbbMakes", craigs.year);
    var makes = JSON.parse(cacheRes);
    var res = makes.map((m) => {
        return {text: m.name, id: m.id};
    });

    // res = searchRank([kbb.extra.desc, kbb.extra.title], res, ["word", "findLongestPrefix"]);
    res = searchRank(sources, res, ["insequenceCount"]);
    if (res.length > 1 && craigs.extra) {
        throw new Error("Failed to find single make");
        res = searchRank([new Source(craigs.extra.body)], res, ["word", "findLongestPrefix"]);
    }

    if (res.length > 1) {
        console.log("Can't determine which make, return null");
        return null;
    }

    var {text: make, id, match} = res[0];
    return {make, id, match}
}


async function getKbbModels(craigs, kbb) {
  var cacheRes = await hgetAsync("kbbCarData", craigs.year + "." + kbb.kbbMake.toLowerCase());
  if(cacheRes !== null) {
    return JSON.parse(cacheRes);
  }

  return null;
}

function removeKbbData(val, kbb) {
  if (!val) {
    return;
  }
  return val.replace(new RegExp('\\s*' + kbb.kbbMake + '\\s*', "gi"), "");
}

async function matchModelsAndStyle(craigs, kbb, sources) {
    var models = await getKbbModels(craigs, kbb);

    let res = searchRank(
        sources,
        models,
        ["insequenceCount"],
        ["model", "styleText"]);

    if(res.length > 1) {
        res = searchRank(
            [new Source('Sedan')],
            res,
            ["insequenceCount"],
            ["styleText"]);
    }

    if (res.length > 1) {
        res[0]["isStyleMatch"] = false;
    }
    else {
        res[0]["isStyleMatch"] = true;
    }
    console.log("after model result");
    // console.log("match model = ", res[0]);
    return res[0];
}

// matchModelsAndStyle({desc: "F350 Super Duty Super Cab XLT Pickup 4D 6 3/4 ft", year: '2014'}, {kbbMake: 'ford'});

module.exports = {matchModelsAndStyle, matchKbbMake: matchKbbMakeId, getApi};
