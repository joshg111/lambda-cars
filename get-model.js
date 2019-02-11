'use strict';

var rp = require('request-promise');
const pConfig = require("./public-config");
var {hgetAsync, hsetAsync} = require('./redis-client');
var {searchRank, filterByRank, fuseSearch} = require('./src/utils/rank-actions');
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


// async function matchKbbMakeId(craigs, kbb) {
//   var link = 'https://www.kbb.com/Api/'+ kbb.extra.api.api + '/' + kbb.extra.api.version + '/vehicle/v1/Makes?vehicleClass=UsedCar&yearid='+craigs.year;
//
//   var options = {
//       uri: link,
//       headers: {
//         'User-Agent': USER_AGENT
//     },
//     timeout: 6000
//   };
//
//   var body = await rp(options);
//   var makes = JSON.parse(body);
//   var res = makes.map((m) => {
//     return {text: m.name, id: m.id};
//   });
//
//   res = searchRank([craigs.desc, craigs.title], res, ["word", "findLongestPrefix"]);
//   if(res.length > 1) {
//     res = searchRank([craigs.extra ? craigs.extra.body : null], res, ["word", "findLongestPrefix"]);
//   }
//
//   if(res.length > 1) {
//     console.log("Can't determine which make, return null");
//     return null;
//   }
//
//   var {text: make, id} = res[0];
//   return {make, id}
// }

async function matchKbbMakeId(craigs, kbb) {
    var cacheRes = await hgetAsync("kbbMakes", craigs.year);
    var makes = JSON.parse(cacheRes);
    // console.log("get makes for year = ", craigs.year, ", makes = ", makes);
    var res = makes.map((m) => {
        return {text: m.name, id: m.id};
    });

    // res = searchRank([kbb.extra.desc, kbb.extra.title], res, ["word", "findLongestPrefix"]);
    res = searchRank([kbb.extra.desc, kbb.extra.title], res, ["insequenceCount"]);
    if (res.length > 1) {
        res = searchRank([craigs.extra ? craigs.extra.body : null], res, ["word", "findLongestPrefix"]);
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

  // var link = 'https://www.kbb.com/Api/'+ kbb.extra.api.api + '/' + kbb.extra.api.version + '/vehicle/v1/Models?makeid=' + kbb.extra.kbbMakeId + '&vehicleClass=UsedCar&yearid=' + craigs.year;
  // var options = {
  //     uri: link,
  //     headers: {
  //       'User-Agent': USER_AGENT
  //   },
  //   timeout: 6000
  // };
  //
  // var body = await rp(options);
  // var models = JSON.parse(body);
  // var res = models.map((model) => model.name);
  //
  // if(res.length > 0) {
  //   // Set cache.
  //
  //   await hsetAsync("kbbModels", kbb.kbbMake + "." + craigs.year, JSON.stringify(res));
  // }

  // return res;
    return null;
}

function removeKbbData(val, kbb) {
  if (!val) {
    return;
  }
  return val.replace(new RegExp('\\s*' + kbb.kbbMake + '\\s*', "gi"), "");
}

// async function matchModels(craigs, kbb) {
//   var models = await getKbbModels(craigs, kbb);
//   var res = models.map((m) => {
//     return {text: removeKbbData(m, kbb)};
//   });
//   console.log("models = ", res);
//
//   // res = searchRank(
//   //   [craigs.desc, craigs.title].map((val) => removeKbbData(val, kbb)),
//   //   res,
//   //   ["word", "findLongestPrefix"]);
//
//   res = searchRank(
//     [craigs.desc, craigs.title].map((val) => removeKbbData(val, kbb)),
//     res,
//     ["insequenceCount"]);
//
//   if(res.length > 1) {
//     console.log("Model search using body content");
//     res = searchRank(
//       [craigs.extra ? craigs.extra.body : null].map((val) => removeKbbData(val, kbb)),
//       res,
//       ["word"]);
//   }
//   if (res.length > 1) {
//     throw new Error("Failed to match model");
//   }
//   console.log("match model = ", res[0].text);
//   return res[0].text;
// }

async function matchModelsAndStyle(craigs, kbb) {
    var models = await getKbbModels(craigs, kbb);
    console.log("after getKbbModels");
    // console.log("models = ", models);

    // let res = fuseSearch([craigs.desc, craigs.title].map((val) => removeKbbData(val, kbb)), models);
    let res = searchRank(
        [kbb.extra.desc,
            kbb.extra.title + (craigs.type ? " " + craigs.type : "")]
            .map((val) => removeKbbData(val, kbb)),
        models,
        ["insequenceCount"],
        ["model", "styleText"]);

    if(res.length > 1) {
        res = searchRank(
            ['Sedan'].map((val) => removeKbbData(val, kbb)),
            res,
            ["insequenceCount"],
            ["styleText"]);
    }
    // if(res.length > 1) {
    //     console.log("Model search using body content");
    //     res = searchRank(
    //         [craigs.extra ? craigs.extra.body : null].map((val) => removeKbbData(val, kbb)),
    //         res,
    //         ["word"]);
    // }
    // if (res.length > 1) {
    //     throw new Error("Failed to match model");
    // }
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
