'use strict';

var assert = require('assert');
var cheerio = require('cheerio'); // Basically jQuery for node.js
var rp = require('request-promise');
var {requestCache} = require('./redis-client');
const pConfig = require("./public-config");
const {matchModelsAndStyle, matchKbbMake} = require("./get-model");
var {searchRank} = require('./src/utils/rank-actions');
var {Source} = require('./src/rank/source');
var {Match} = require('./src/rank/match');

const USER_AGENT = pConfig.rp.USER_AGENT;
const OPTIONS = pConfig.rp.OPTIONS;
const RETRYCOUNT = 2;


async function scrapeHrefs(uri, retryCount=0) {
  var cars = [];

  try {
    var $ = await rp({...OPTIONS, uri});
    $('ul.rows a.result-image').attr('href',
      (i, e) => {
        cars.push(e);
      })

  }
  catch(err) {
    if (retryCount < RETRYCOUNT) {
      return await scrapeHrefs(uri, retryCount + 1);
    }
    console.log("getCarHrefs = ", err);
    return Promise.reject(err);
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

async function getCraigs(href, retryCount=0) {

  var res = {};

  try {
    var $ = await rp({...OPTIONS, uri: href});
    res["price"] = $('span.postingtitletext span.price').text().trim().replace('$', '');

    res["title"] = $('span.postingtitletext span#titletextonly').text().replace(/-/, ' ').trim();

    res["extra"] = {"body": $('section#postingbody').text()}

    // Get the first attr group.
    var mainAttrs = $('p.attrgroup').eq(0).find('span').text().trim();
    var splitMainAttrs = /^(\d+) (.*)/g.exec(mainAttrs);
    console.log(splitMainAttrs);
    res["year"] = splitMainAttrs[1];
    res["desc"] = splitMainAttrs[2] ? splitMainAttrs[2] : "";
    res.desc = res.desc.replace(/-/, ' ');
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
    if (retryCount < RETRYCOUNT) {
        return await getCraigs(href, retryCount+1)
    }
    console.log("getCraigs = ", err);
    return Promise.reject(err);
  }
  console.log("getCraigs res = ", res);
  return res;
}

// getKbbStyle({'year': '2017', 'style': 'limited'}, {'kbbMake': 'lexus', 'kbbModel': 'lx'}).then(console.log);
// getKbbStyle({'year': '1998', 'style': 'ex'}, {'kbbMake': 'Honda', 'kbbModel': 'Civic'}).then(console.log);
// getKbbStyle({'year': '2010', 'style': 'ex-l'}, {'make': 'Honda', 'model': 'Accord'}).then(console.log);
const KBB_PRICE_RETRY_COUNT = 2;
async function getKbbPrice(link, retryCount=0) {
  console.log("getKbbPrice retry = ", retryCount);

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
    if (retryCount < KBB_PRICE_RETRY_COUNT) {
        return await getKbbPrice(link, retryCount + 1);
    }
    console.log("getKbbPrice err = ", err);
    // throw new Error(err);
    return Promise.reject(err);
  }

  return kbbPrice;
}

// getKbbPrice('https://www.kbb.com/nissan/xterra/2003/se-sport-utility-4d/?vehicleid=2984&intent=buy-used&modalview=false&pricetype=private-party&condition=good&mileage=130027').then(console.log);

// For some `data` with `key`, remove `match` from data.
function removeMatch(source, matchWords) {
  for (let match of matchWords) {
      // Replace match with a single space so we don't smush words together.
      source.data = source.data.replace(new RegExp("\\s?" + match + "\\s?", "gi"), " ").trim();
  }
}

// let data = {extra: {desc: "this is my asdfdesc"}};
// removeMatch(["extra", "desc"], data, "asdf");
// console.log(data);

function removeMatchFromSources(matches) {
    for (const match of matches) {
        let sourceArr = match.source.data.split(/\s+/gi);
        for (const matchIndex of match.matches.reverse()) {
            sourceArr.splice(matchIndex, 1);
        }
        match.source.data = sourceArr.join(' ');
    }
}

async function getKbb(craigs) {
  var kbb = {extra:{desc: craigs.desc, title: craigs.title}};
  let sources = [new Source(craigs.desc), new Source(craigs.title + (craigs.type ? " " + craigs.type : ""))];
  removeMatch(sources[0], [craigs.year]);
  removeMatch(sources[1], [craigs.year]);
    // removeMatch(["extra", "title"], kbb, [craigs.year]);
  try {
    var kbbMake = await matchKbbMake(craigs, sources);
    console.log("after matchKbbMake");
    assert(kbbMake.make);
    assert(kbbMake.id);
    // console.log("kbbMake.match = ", kbbMake.match);
    // console.log("before sources = ", sources.toString());
    // removeMatch(["extra", "desc"], kbb, kbbMake.match);
    removeMatchFromSources(kbbMake.match);
    // console.log("after sources = ", sources.toString());
    // Need to reverse so we try to remove the appropriate match first, it's in the same order as the source list.
    // removeMatch(["extra", "title"], kbb, kbbMake.match.reverse());
    kbb["kbbMake"] = kbbMake.make;
    kbb.extra["kbbMakeId"] = kbbMake.id;
    var match = await matchModelsAndStyle(craigs, kbb, sources);
    // console.log("after matchModelsAndStyle");
    kbb["kbbModel"] = match.model;
    assert(kbb.kbbModel);
    
    var kbbLink = match.href;
    kbbLink = kbbLink.replace(/&mileage=\d*/g, "");
    kbbLink += craigs.odometer ? '&mileage=' + craigs.odometer : "";
    kbb["kbbLink"] = kbbLink;
    kbb["kbbStyle"] = match.isStyleMatch ? match.styleText : '';
    assert(kbb.kbbLink);
    kbb["kbbPrice"] = await getKbbPrice(kbb.kbbLink);
    assert(kbb.kbbPrice);
  }
  catch(err) {
    console.log("getKbb = ", err);
    return Promise.reject(err);
  }

  delete kbb.extra;

  return kbb
}

async function handleCar(href) {
  let startTime = new Date();
  try {
    // First, check the cache.
    // var cacheRes = await requestCache("get", {key: href});
    // if(cacheRes !== null) {
    //   return cacheRes;
    // }
    console.log("Cache miss");

    var craigs = await getCraigs(href);
    var kbb = await getKbb(craigs);
    console.log("after kbb");

    // Calc percentage difference.
    var craigsPrice = parseInt(craigs.price);
    var kbbPrice = parseInt(kbb.kbbPrice);
    var percentAboveKbb = Math.round(((craigsPrice / kbbPrice) - 1) * 100);
    delete craigs.extra;
    let endTime = new Date();
    var res = {...craigs, ...kbb, percentAboveKbb, timeDiff: endTime - startTime};

    // Set the result in the cache.
    await requestCache("set", {key: href, value: res});
  }
  catch(e) {
    console.log("handleCar err = ", e, "craigs href = ", href, ", craigs year = ", craigs.year);
    return null;
  }

  return res;
}

// TESTING 

handleCar('https://sandiego.craigslist.org/esd/cto/d/lakeside-subaru-forester-used/6892934925.html').then(console.log);

// handleCar('https://sandiego.craigslist.org/csd/cto/d/fontana-2017-mercedes-benz-amg-gle-43/6890065771.html').then(console.log);
// handleCar('https://sandiego.craigslist.org/nsd/cto/d/san-diego-babied-2004-mercedes-benz-clk/6896550181.html').then(console.log);

// handleCar('https://sandiego.craigslist.org/csd/cto/d/san-diego-li-bmw/6896730929.html').then(console.log);




async function getCars(carHrefs) {
  try {
    var startTime = new Date();

    var cars = [];
    for (var i = 0; i < 50 && i < carHrefs.length; i++) {
        cars.push(handleCar(carHrefs[i]));
    }

    console.log("before carsResolved");

    // There seems to be some cars that hang here. Can we force a timeout in Promise.all(..)?
    var carsResolved = await Promise.all(cars);
    console.log("after carsResolved");

    carsResolved = carsResolved.filter((element, index) => {
        return element !== null;
    });

    // Sort
    carsResolved.sort((a, b) => {
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

    return {
        statusCode: 200,
        body: JSON.stringify({
            cars: carsResolved
        }),
    };
  }
  catch(err) {
    console.log("Caught exception getCars, err = ", err);
  }
}

module.exports.cars = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  try {

      console.log("event", event);
      var input = JSON.parse(event.body);
      console.log("input = ", input);

      var hrefPromises = [];
      if ("make" in input && "model" in input) {
          hrefPromises.push(getCarHrefs(input));
          hrefPromises.push(getCarHrefsWithSearch({
              ...input,
              query: '"' + input.make + '"' + '+' + '"' + input.model + '"'
          }));
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

      return await getCars(carHrefs);
  }
  catch(err) {
    console.log("Caught global exception, err = ", err);
  }
};

module.exports.getCarsFromHrefs = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  // return {
  //   statusCode: 200,
  //   body: JSON.stringify({
  //       cars: "hi"
  //   }),
  // };
  try {
    console.log("event", event);
    var input = JSON.parse(event.body);
    console.log("input = ", input);
  
    var carHrefs = JSON.parse(event.body).urls;
  
    return await getCars(carHrefs);
  } catch(err) {
    console.log("Caught global exception, err = ", err);
  }
};

// var input = {urls: ['https://orangecounty.craigslist.org/cto/d/mission-viejo-1999-mercedes-benz-ml-320/6879393986.html']};
// var input = {query: "mercedes-benz", city: "sandiego"};
// var input = {query: "honda accord", city: "sandiego"};
// module.exports.getCarsFromHrefs({body: JSON.stringify(input)}, {callbackWaitsForEmptyEventLoop: false});


// handleCar("https://sandiego.craigslist.org/csd/cto/d/sacramento-2004-mercedes-benz-sprinter/6820532634.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/csd/cto/d/sacramento-2004-mercedes-benz-sprinter/6820532634.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/csd/cto/d/san-diego-2014-mercedes-benz-63-amg-507/6791106958.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/csd/cto/d/2010-mercedes-benz-e350-sport-coupe-65k/6803936754.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/nsd/cto/d/san-diego-mercedes-benz-glk-350/6802530724.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/csd/cto/d/san-diego-2007-mercedes-benz-sl550/6795086570.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/nsd/cto/d/fallbrook-mercedes-benz-e320/6804671458.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/nsd/cto/d/san-diego-honda-accord-2005/6811042675.html", {}).then(console.log);

// handleCar("https://sandiego.craigslist.org/nsd/cto/d/vista-2012-mercedes-benz-c250/6800515646.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/csd/cto/d/san-diego-mercedes-benz-class-500/6798491481.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/csd/cto/d/san-diego-2003-mercedes-benz-sl500/6810211475.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/nsd/cto/d/san-luis-rey-2008-mercedes-benz-clk550/6796103378.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/csd/cto/d/rancho-santa-fe-2006-dodge-sprinterwb/6804150219.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/csd/cto/d/san-diego-2013-mercedes-benz-sl63/6794057461.html", {}).then(console.log);


// handleCar("https://sandiego.craigslist.org/csd/cto/d/1993-mercedes-benz-300-ce/6799840767.html", {}).then(console.log);


// handleCar("https://sandiego.craigslist.org/csd/cto/d/san-diego-2006-mercedes-benz-slr-mclaren/6799954428.html", {}).then(console.log);
// handleCar("https://sandiego.craigslist.org/csd/cto/d/san-diego-2004-mercedes-benz-ml500/6808517821.html", {}).then(console.log);