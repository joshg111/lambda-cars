'use strict';

var cheerio = require('cheerio'); // Basically jQuery for node.js
var rp = require('request-promise');
var {requestCache} = require('./redis-client');
const pConfig = require("./public-config");
const {matchKbbModels} = require("./get-model");

const USER_AGENT = pConfig.rp.USER_AGENT
const OPTIONS = pConfig.rp.OPTIONS;


async function getCarHrefs({make, model, city}) {
  console.log("make = ", make, "model = ", model);
  var makeModel = make + "+" + model.replace(/\s*/g, '');
  var uri = 'https://' + city + '.craigslist.org/search/cto?sort=date&srchType=T&hasPic=1&bundleDuplicates=1&min_price=0&max_price=20000&auto_make_model=' + makeModel + '&auto_title_status=1';
  console.log(uri);
  try {
    var $ = await rp({...OPTIONS, uri});
    var cars = [];
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

async function getCraigs(href, {make, model}) {

  var res = {};

  try {
    var $ = await rp({...OPTIONS, uri: href});
    res["price"] = $('span.postingtitletext span.price').text().trim().replace('$', '');

    res["title"] = $('span.postingtitletext span#titletextonly').text().trim();

    res["extra"] = {"body": $('section#postingbody').text()}

    // Get the first attr group.
    var mainAttrs = $('p.attrgroup').eq(0).find('span').text().trim();
    res["year"] = /^(\d+) /g.exec(mainAttrs)[1];
    var re = new RegExp(model+" (.*)", "i");
    var styleMatch = mainAttrs.match(re);
    res["style"] = styleMatch ? styleMatch[1] : "";
    res["desc"] = res.year + " " + make + " " + model + " " + res.style;
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
    ['odometer', 'year', 'desc', 'price', 'timeago', 'thumbnail', 'location', 'style'].forEach(e => {
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

// function searchRank(craigsStyle, kbbStyles) {
//   if(!craigsStyle) {
//     return null
//   }
//
//   var res = [];
//
//   var craigsSplit = craigsStyle.split(" ");
//   console.log(craigsSplit);
//
//   for(var kbbStyle of kbbStyles) {
//     console.log("kbbStyle = ", kbbStyle);
//     var newRankedObj = {'rank': 0, 'value': kbbStyle};
//     res.push(newRankedObj);
//
//     for(var craigsWord of craigsSplit) {
//       console.log("word", craigsWord);
//       var kbbSplit = kbbStyle.text.split(" ");
//       console.log("kbbsplit", kbbSplit);
//
//       for(var kbbWord of kbbSplit) {
//         console.log("kbbword", kbbWord);
//         if((kbbWord.match(new RegExp(craigsWord, "gi"))) !== null) {
//           console.log("Found match craigsWord = ", craigsWord, ", kbbWord = ", kbbWord);
//           newRankedObj.rank++;
//         }
//       }
//     }
//   }
//   console.log("searchRank = ", res);
//   return res;
// }

// Input
// source: String - Eg. craigsStyle or posting contents/title.
// targets: [String] - Eg. KbbStyles or KbbBodyTypes (Sedan/Coupe/Hatchback/Wagon)
function searchRank(source, targets) {
  if(!source) {
    return null
  }

  var res = [];

  for(var target of targets) {
    console.log("target = ", target);
    var newRankedObj = {'rank': 0, 'value': target};
    res.push(newRankedObj);

    var targetSplit = target.text.split(" ");
    console.log("targetSplit", targetSplit);

    for(var targetWord of targetSplit) {
      console.log("targetWord", targetWord);
      if((source.match(new RegExp("([^\\w-]|^)" + targetWord + "([^\\w-]|$)", "gi"))) !== null) {
        console.log("Found match source = ", source, ", targetWord = ", targetWord);
        newRankedObj.rank++;
      }
    }
  }
  console.log("searchRank = ", res);
  return res;
}

// searchRank("ABC", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);
// searchRank("asdf asdf ABC asdf", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);
// searchRank("asdf asdf asdfABC asdf", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);
// searchRank("asdf asdf abc", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);

// Return all the highest ranked items.
function filterByRank(items) {
  var currMax = 0;
  for(var item of items) {
    currMax = Math.max(currMax, item.rank)
  }
  var filtered = items.filter((item) => item.rank === currMax).map((item) => item.value);
  var numFiltered = items.length - filtered.length;

  return {numFiltered, filtered};
}

function matchStyle(craigs, kbbStyles) {
  // Match the first word in the craigsStyle, then for subsequent words try to qualify the existing matches unless
  // there are no existing matches.
  var res = {filtered: kbbStyles, numFiltered: 0};
  if(craigs.type) {
    res = filterByRank(searchRank(craigs.type, res.filtered));
    console.log("type numFiltered = ", res.numFiltered);
  }

  if(craigs.style) {
    res = filterByRank(searchRank(craigs.style, res.filtered));
    console.log("style numFiltered = ", res.numFiltered);
  }

  if(res.filtered.length > 1) {
    // Try searching the title.
    res = filterByRank(searchRank(craigs.title, res.filtered));
    console.log("title numFiltered = ", res.numFiltered);
  }

  if(res.filtered.length > 1) {
    // Try searching the body.
    res = filterByRank(searchRank(craigs.extra.body, res.filtered));
    console.log("body numFiltered = ", res.numFiltered);
  }

  if(res.filtered.length > 1) {
    // Would rather have a randomly picked sedan.
    res = filterByRank(searchRank('Sedan', res.filtered));
    console.log("default Sedan numFiltered = ", res.numFiltered);
  }

  return res.filtered[0].href;
}

// console.log(matchStyle("abc", [{'text': "abc", 'href': 'habc'}, {'text': "ghi sedan", 'href': 'hghi'}, {'text': "abc", 'href': 'habc'}]));
// console.log(matchStyle("abc", [{'text': "abc sedan", 'href': 'habc'}, {'text': "ghi sedan", 'href': 'hghi'}, {'text': "abc sedan", 'href': 'habc2'}]));
// console.log(matchStyle(null, [{'text': "abc sedan", 'href': 'habc'}, {'text': "ghi sedan", 'href': 'hghi'}, {'text': "abc sedan", 'href': 'habc2'}]));

async function getStyleList(craigs, {make, model}, kbbModel) {
  console.log(model);
  var link = 'https://www.kbb.com/' + make.toLowerCase().replace(/ /gi, '-') + '/' + kbbModel.toLowerCase().replace(/ /gi, '-').replace('/[\(|\)]/g', '') + '/' + craigs.year + '/styles/?intent=buy-used';
  var $ = await rp({...OPTIONS, uri: link});

  var styleLinks = $('a.style-link').get();
  var styleList = [];
  for(var style of styleLinks) {
    styleList.push({'text': $(style).find("div.button-header").text(), 'href': $(style).attr('href')});
  }

  return styleList;
}

// getStyleList({'year': '1998'}, {'make': 'honda', 'model': 'civic'}).then(console.log);

async function getKbbStyle(craigs, {make, model}, kbbModel) {
  // Return - A link to the next kbb page after choosing the style.

  var res = null;

  try {
    var styleList = await getStyleList(craigs, {make, model}, kbbModel);

    // TODO: Match style.
    var style = await matchStyle(craigs, styleList);
    style = style.replace(/\/options/g, "");
    res = 'https://www.kbb.com' + style + '&pricetype=private-party&condition=good';
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

// getKbbStyle({'year': '2010', 'style': 'limited'}, {'make': 'ford', 'model': 'edge'}).then(console.log);
// getKbbStyle({'year': '1998', 'style': 'ex'}, {'make': 'Honda', 'model': 'Civic'}).then(console.log);
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

  try {
    var body = await rp(options);
    kbbPrice = /defaultprice%22%3a(\d+)%/g.exec(body)[1];
    // console.log("kbbPrice = ", kbbPrice);

  }
  catch(err) {
    console.log("getKbbPrice err = ", err);
    throw new Error(err);
  }

  return kbbPrice;
}

async function getKbb(craigs, input) {
  var kbbLink;

  var kbbModel = await matchKbbModels({...input, ...craigs});
  kbbLink = await getKbbStyle(craigs, input, kbbModel);
  if(kbbLink === null) {
    return null;
  }


  return {kbbPrice: await getKbbPrice(kbbLink), kbbLink, kbbModel}
}

async function handleCar(href, input) {

  try {
    // First, check the cache.
    // var cacheRes = await requestCache("get", {key: href});
    // if(cacheRes !== null) {
    //   return cacheRes;
    // }
    console.log("Cache miss");

    var craigs = await getCraigs(href, input);
    var kbb = await getKbb(craigs, input);

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
    console.log("handleCar err = ", e);
    return null;
  }

  return res;
}

// handleCar("https://sandiego.craigslist.org/csd/cto/d/2015-honda-civic-si-sedan-30k/6644464694.html", {"make": "Honda", "model": "civic"}).then(console.log)
// handleCar("https://inlandempire.craigslist.org/cto/d/2016-honda-civic-ex-4dr-sedan/6665090723.html", {"make": "Honda", "model": "civic"}).then(console.log)
// handleCar("https://sandiego.craigslist.org/csd/cto/d/2004-honda-civic-ex-coupe/6644109706.html", {"make": "Honda", "model": "civic"}).then(console.log)
handleCar("https://sandiego.craigslist.org/nsd/cto/d/08-ford-150-crew-cab-xlt/6687567052.html", {"make": "Ford", "model": "F-150"}).then(console.log)




module.exports.cars = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  var startTime = new Date();

  console.log("event", event);
  var input = JSON.parse(event.body);
  console.log("input = ", input);

  var carHrefs = await getCarHrefs(input);

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
  console.log("result length = ", carsResolved.length)

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

// var input = {make: "toyota", model: "camry"};
// module.exports.cars({body: JSON.stringify(input)}, null, null);

// handleCar('https://sandiego.craigslist.org/csd/cto/d/2012-toyota-camry-xle-1-owner/6606439928.html', input);
// getCraigs('https://sandiego.craigslist.org/csd/cto/d/2012-toyota-camry-xle-1-owner/6606439928.html', input);
// getKbbPrice('https://www.kbb.com/toyota/camry/2009/sedan-4d/?vehicleid=227104&intent=buy-used&mileage=113350&pricetype=private-party&condition=good')
// getKbb({year: '2009'}, input);
