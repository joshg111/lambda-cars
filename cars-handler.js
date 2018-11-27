'use strict';

var assert = require('assert');
var cheerio = require('cheerio'); // Basically jQuery for node.js
var rp = require('request-promise');
var {requestCache} = require('./redis-client');
const pConfig = require("./public-config");
const {matchKbbModels, matchKbbMake, getApi} = require("./get-model");
var {searchRank, filterByRank} = require('./src/utils/rank-actions');

const USER_AGENT = pConfig.rp.USER_AGENT
const OPTIONS = pConfig.rp.OPTIONS;


async function scrapeHrefs(uri) {
  var cars = [];

  try {
    var $ = await rp({...OPTIONS, uri});
    $('ul.rows a.result-image').attr('href',
      (i, e) => {
        cars.push(e);
      })

  }
  catch(err) {
    console.log("getCarHrefs = ", err);
    throw new Error(err);
  }

  return cars;
}

async function getCarHrefs({make, model, city}) {
  console.log("make = ", make, "model = ", model);
  var makeModel = make + "+" + model.replace(/\s*/g, '');
  var uri = 'https://' + city + '.craigslist.org/search/cto?sort=date&srchType=T&auto_transmission=2&hasPic=1&bundleDuplicates=1&min_price=0&max_price=20000&auto_make_model=' + makeModel + '&auto_title_status=1';
  console.log(uri);

  return await scrapeHrefs(uri);

}

function buildCraigsUrl(params) {
  var url = '';
  for (var k in params) {
    if (params[k]) {
      url += "&" + k + '=' + params[k]
    }
  }

  return url;
}

async function getCarHrefsWithSearch(params) {

  var {city, query} = params;
  delete params['city'];

  params['query'] = query.replace(/\s+/gi, '+');

  // var uri = 'https://' + city + '.craigslist.org/search/cto?query=' + query + '&sort=date&srchType=T&auto_transmission=2&hasPic=1&bundleDuplicates=1&min_price=0&max_price=20000&auto_title_status=1';
  var uri = 'https://' + city + '.craigslist.org/search/cto?sort=date&srchType=T&auto_transmission=2&hasPic=1&bundleDuplicates=1&auto_title_status=1' + buildCraigsUrl(params);
  console.log(uri);

  return await scrapeHrefs(uri);
}

async function matchCraigsAttrs(attrs) {
  console.log("matchCraigsAttrs: attrs = ", attrs);
  var res = {};
  attrs.forEach((elem, index) => {
    try {
      var splitElem = /(.+): (.+)/g.exec(elem);
      var key = splitElem[1];
      var val = splitElem[2];
      res[key.trim()] = val.trim();
    }
    catch(err) {
      console.log("matchCraigsAttrs failed with elem = ", elem);
    }
  });

  //TODO: Transform attributes.
  if('odometer' in res && res.odometer && res.odometer.length < 4) {
    res.odometer *= 1000;
  }

  return res;
}

async function getCraigs(href) {

  var res = {};

  try {
    var $ = await rp({...OPTIONS, uri: href});
    res["price"] = $('span.postingtitletext span.price').text().trim().replace('$', '');

    res["title"] = $('span.postingtitletext span#titletextonly').text().trim();

    res["extra"] = {"body": $('section#postingbody').text()}

    // Get the first attr group.
    var mainAttrs = $('p.attrgroup').eq(0).find('span').text().trim();
    var splitMainAttrs = /^(\d+) (.*)/g.exec(mainAttrs);
    console.log(splitMainAttrs);
    res["year"] = splitMainAttrs[1];
    res["desc"] = splitMainAttrs[2] ? splitMainAttrs[2] : "";
    // var re = new RegExp(model+" (.*)", "i");
    // var styleMatch = mainAttrs.match(re);
    // res["style"] = styleMatch ? styleMatch[1] : "";
    res["timeago"] = $('div.postinginfos time').map((index, elem) => {
      return $(elem).attr('datetime');
    }).get()[0];
    var location = $('span.postingtitletext small');
    res["location"] = location ? location.text().trim() : '';
    res["thumbnail"] = $('div.slide.first.visible img').attr('src');

    var attrs = await matchCraigsAttrs($('p.attrgroup').eq(1).find('span').map((index, elem) => {
      return $(elem).text();
    }).get());
    res = {...res, ...attrs, craigsLink: href};
    ['year', 'desc', 'price', 'timeago', 'thumbnail', 'location'].forEach(e => {
      if(! (e in res)) {
        throw new Error("Missing craigslist param = " + e);
      }
    })
  }
  catch(err) {
    console.log("getCraigs = ", err);
    throw new Error(err);
  }
  console.log("getCraigs res = ", res);
  return res;
}


function matchStyle(craigs, kbbStyles) {
  // Match the first word in the craigsStyle, then for subsequent words try to qualify the existing matches unless
  // there are no existing matches.

  var res = kbbStyles;

  res = searchRank([craigs.desc, craigs.title, craigs.type], res, ["word", "damerauLevenshteinDistance", "findLongestPrefix"]);
  if (res.length > 1) {
      res = searchRank([craigs.desc, craigs.title, craigs.type], res, ["insequenceCount"]);
  }
  if(res.length > 1) {
    res = searchRank([craigs.extra ? craigs.extra.body : null, 'Sedan'], res, ["word", "findLongestPrefix"]);
  }

  console.log(res);
  return res[0].href;
}

// console.log(matchStyle("abc", [{'text': "abc", 'href': 'habc'}, {'text': "ghi sedan", 'href': 'hghi'}, {'text': "abc", 'href': 'habc'}]));
// console.log(matchStyle("abc", [{'text': "abc sedan", 'href': 'habc'}, {'text': "ghi sedan", 'href': 'hghi'}, {'text': "abc sedan", 'href': 'habc2'}]));
// console.log(matchStyle(null, [{'text': "abc sedan", 'href': 'habc'}, {'text': "ghi sedan", 'href': 'hghi'}, {'text': "abc sedan", 'href': 'habc2'}]));

async function getStyleList(rsp) {


  var $ = cheerio.load(rsp.body);

  var styleLinks = $('a.style-link').get();
  var styleList = [];
  for(var style of styleLinks) {
    styleList.push({'text': $(style).find("div.button-header").text(), 'href': $(style).attr('href')});
  }

  if(styleList.length < 1) {
    console.log("Cant find style for kbb link = ", link);
  }

  return styleList;
}

// getStyleList({'year': '2017'}, {'kbbMake': 'lexus', 'kbbModel': 'lx'}).then(console.log);

/**
* Match the style if there is one, then get the options link.
* Then, construct the price link and return it.
**/
async function getKbbStyle(craigs, kbb) {
  // Return - A link to the next kbb page after choosing the style.
  var res = null;

  try {

    var link = 'https://www.kbb.com/' + kbb.kbbMake.toLowerCase().replace(/ /gi, '-') + '/' + kbb.kbbModel.toLowerCase().replace(/ /gi, '-').replace('/[\(|\)]/g', '') + '/' + craigs.year + '/styles/?intent=buy-used';

    var options = {
      uri: link,
      resolveWithFullResponse: true,
      headers: {
        'User-Agent': pConfig.rp.USER_AGENT
      },
      timeout: 6000
    };

    var rsp = await rp(options);
    console.log(rsp.request.uri.path);
    var requestUri = rsp.request.uri.path;

    if(!requestUri.includes("styles")) {
      // In this case, there is no style to match. Kbb redirected us to the
      // options page which is where the style links take us. At the end of the
      // function we construct the price link.
      res = requestUri
    }
    else {
      var styleList = await getStyleList(rsp);

      // Match style.
      var res = await matchStyle(craigs, styleList);
    }

    res = res.replace(/\/options/g, "");
    res = 'https://www.kbb.com' + res + '&pricetype=private-party&condition=good';
    res = res.replace(/&mileage=\d*/g, "");
    res += craigs.odometer ? '&mileage=' + craigs.odometer : "";

    // console.log("styleLinks = ", styleLinks);
  }
  catch(err) {
    console.log("getKbbStyle = ", err);
    throw new Error(err);
  }
  console.log("getKbbStyle res = ", res);
  return res;
}

// getKbbStyle({'year': '2017', 'style': 'limited'}, {'kbbMake': 'lexus', 'kbbModel': 'lx'}).then(console.log);
// getKbbStyle({'year': '1998', 'style': 'ex'}, {'kbbMake': 'Honda', 'kbbModel': 'Civic'}).then(console.log);
// getKbbStyle({'year': '2010', 'style': 'ex-l'}, {'make': 'Honda', 'model': 'Accord'}).then(console.log);

async function getKbbPrice(link) {
  // console.log(link);

  var kbbPrice = null;

  var options = {
      uri: link,
      headers: {
        'User-Agent': USER_AGENT
    },
    timeout: 6000
  };

  var body;
  try {
    body = await rp(options);
    kbbPrice = /defaultprice%22%3a(\d+)%/g.exec(body)[1];
    // console.log("kbbPrice = ", kbbPrice);

  }
  catch(err) {
    console.log("getKbbPrice err = ", err);
    throw new Error(err);
  }

  return kbbPrice;
}

// getKbbPrice('https://www.kbb.com/nissan/xterra/2003/se-sport-utility-4d/?vehicleid=2984&intent=buy-used&modalview=false&pricetype=private-party&condition=good&mileage=130027').then(console.log);

async function getKbb(craigs) {
  var kbb = {extra:{}};
  try {
    kbb.extra["api"] = await getApi();
    assert(kbb.extra.api);
    var kbbMake = await matchKbbMake(craigs, kbb);
    assert(kbbMake.make);
    assert(kbbMake.id);
    kbb["kbbMake"] = kbbMake.make;
    kbb.extra["kbbMakeId"] = kbbMake.id;
    kbb["kbbModel"] = await matchKbbModels(craigs, kbb);
    assert(kbb.kbbModel);
    kbb["kbbLink"] = await getKbbStyle(craigs, kbb);
    assert(kbb.kbbLink);
    kbb["kbbPrice"] = await getKbbPrice(kbb.kbbLink)
    assert(kbb.kbbPrice);
  }
  catch(err) {
    console.log("getKbb = ", err);
    throw new Error(err);
  }

  delete kbb.extra
  return kbb
}

async function handleCar(href, input) {

  try {
    // First, check the cache.
    // var cacheRes = await requestCache("get", {key: href});
    // if(cacheRes !== null) {
    //   return cacheRes;
    // }
    console.log("Cache miss");

    var craigs = await getCraigs(href);
    var kbb = await getKbb(craigs);

    // Calc percentage difference.
    var craigsPrice = parseInt(craigs.price);
    var kbbPrice = parseInt(kbb.kbbPrice);
    var percentAboveKbb = Math.round(((craigsPrice / kbbPrice) - 1) * 100);
    delete craigs.extra;
    var res = {...craigs, ...kbb, percentAboveKbb, ...input}

    // Set the result in the cache.
    await requestCache("set", {key: href, value: res});
  }
  catch(e) {
    console.log("handleCar err = ", e, "craigs href = ", href);
    return null;
  }

  return res;
}



handleCar("https://sandiego.craigslist.org/csd/cto/d/low-mileshonda-accord-exl/6752360209.html", {"make": "Honda", "model": "civic"}).then(console.log)

// handleCar("https://sandiego.craigslist.org/csd/cto/d/2000-mercedes-ml-320-awd-suv/6690082591.html", {"make": "Honda", "model": "civic"}).then(console.log)

// handleCar("https://sandiego.craigslist.org/csd/cto/d/mercedes-benz-gl-450-4matic/6700998207.html", {"make": "Honda", "model": "civic"}).then(console.log)

// handleCar("https://sandiego.craigslist.org/nsd/cto/d/clean-title-2004-nissan/6700899238.html", {"make": "Honda", "model": "civic"}).then(console.log)

// handleCar("https://sandiego.craigslist.org/nsd/cto/d/2010-vw-touareg-v6-64k-miles/6700873819.html", {"make": "Honda", "model": "civic"}).then(console.log)

// handleCar("https://sandiego.craigslist.org/nsd/cto/d/2008-toyota-highlander-hybrid/6676572664.html", {"make": "Honda", "model": "civic"}).then(console.log)

// handleCar("https://sandiego.craigslist.org/csd/cto/d/2000-mercedes-ml-320-awd-suv/6690082591.html", {"make": "Honda", "model": "civic"}).then(console.log)

// handleCar("https://sandiego.craigslist.org/nsd/cto/d/great-suv-1999-chevy-blazer/6693052382.html", {"make": "Honda", "model": "civic"}).then(console.log)

// handleCar("https://sandiego.craigslist.org/csd/cto/d/mercedes-benz-gl-450-awd-suv/6700169350.html", {"make": "Honda", "model": "civic"}).then(console.log)

// handleCar("https://sandiego.craigslist.org/nsd/cto/d/1999-chevy-suburban-suv-low/6699388146.html", {"make": "Honda", "model": "civic"}).then(console.log)
// handleCar("https://inlandempire.craigslist.org/cto/d/2016-honda-civic-ex-4dr-sedan/6665090723.html", {"make": "Honda", "model": "civic"}).then(console.log)
// handleCar("https://sandiego.craigslist.org/csd/cto/d/2004-honda-civic-ex-coupe/6644109706.html", {"make": "Honda", "model": "civic"}).then(console.log)
// handleCar("https://sandiego.craigslist.org/csd/cto/d/2006-ford-150-super-cab-low/6680394811.html", {}).then(console.log)




module.exports.cars = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  var startTime = new Date();

  console.log("event", event);
  var input = JSON.parse(event.body);
  console.log("input = ", input);

  var hrefPromises = [];
  if("make" in input && "model" in input) {
    hrefPromises.push(getCarHrefs(input));
    hrefPromises.push(getCarHrefsWithSearch({...input, query: '"' + input.make + '"' + '+' + '"' + input.model + '"'}));
  }

  else {
    hrefPromises.push(getCarHrefsWithSearch(input));
  }

  var carHrefs = (await Promise.all(hrefPromises)).reduce((acc, cur) => {
  	// return new Set([...acc, ...cur]);
    return acc.concat(cur);
  }, []);

  var seen = {};
  carHrefs = carHrefs.filter((item) => {
      return seen.hasOwnProperty(item) ? false : (seen[item] = true);
  });

  var cars = [];
  for(var i = 0; i < 50 && i < carHrefs.length; i++) {
    cars.push(handleCar(carHrefs[i], input));
  }

  var carsResolved = await Promise.all(cars);

  carsResolved = carsResolved.filter((element, index) => {
    return element !== null;
  });

  // Sort
  carsResolved.sort((a,b) => {
    return (a.percentAboveKbb - b.percentAboveKbb);
  })

  console.log("carsResolved = ", carsResolved);
  console.log("result length = ", carsResolved.length);
  console.log("expected length = ", cars.length);

  var endTime = new Date();
  var timeDiff = endTime - startTime; //in ms
  // strip the ms
  timeDiff /= 1000;
  console.log("time = ", timeDiff);

  const rr = {
    statusCode: 200,
    body: JSON.stringify({
      cars: carsResolved
    }),
  };

  callback(null, rr);

};

// var input = {query: "suv", city: "sandiego"};
// module.exports.cars({body: JSON.stringify(input)}, {callbackWaitsForEmptyEventLoop: false}, null);

// handleCar('https://sandiego.craigslist.org/csd/cto/d/2012-toyota-camry-xle-1-owner/6606439928.html', input);
// getCraigs('https://sandiego.craigslist.org/csd/cto/d/2012-toyota-camry-xle-1-owner/6606439928.html', input);
// getKbbPrice('https://www.kbb.com/toyota/camry/2009/sedan-4d/?vehicleid=227104&intent=buy-used&mileage=113350&pricetype=private-party&condition=good')
// getKbb({year: '2009'}, input);
