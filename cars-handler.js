'use strict';

var cheerio = require('cheerio'); // Basically jQuery for node.js
var rp = require('request-promise');

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.167 Safari/537.36';

const OPTIONS = {
  transform: function (body) {
      return cheerio.load(body);
  },
  headers: {
    'User-Agent': USER_AGENT
  },
  timeout: 6000
};

async function getCarHrefs({make, model}) {
  console.log("make = ", make, "model = ", model);
  var makeModel = make + "+" + model.replace(/\s*/g, '');
  var uri = 'https://sandiego.craigslist.org/search/cto?sort=date&srchType=T&hasPic=1&bundleDuplicates=1&min_price=0&max_price=20000&auto_make_model=' + makeModel + '&auto_title_status=1';
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
  }

  return cars;
}

async function matchCraigsAttrs(attrs) {
  var res = {};
  attrs.forEach((elem, index) => {
    var splitElem = /(.+): (.+)/g.exec(elem);
    var key = splitElem[1];
    var val = splitElem[2];
    res[key.trim()] = val.trim();
  });

  return res;
}

async function getCraigs(href, {make, model}) {

  var res = {};

  try {
    var $ = await rp({...OPTIONS, uri: href});
    res["price"] = $('span.postingtitletext span.price').text().trim().replace('$', '');

    // Get the first attr group.
    var mainAttrs = $('p.attrgroup').eq(0).find('span').text().trim();
    res["year"] = /^(\d+) /g.exec(mainAttrs)[1];
    var re = new RegExp(model+" (.*)", "i");
    var styleMatch = mainAttrs.match(re);
    res["style"] = styleMatch ? styleMatch[1] : "";
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
  }
  catch(err) {
    console.log("getCraigs = ", err);
    return null;
  }
  return res;
}

async function getKbbStyle(craigs, {make, model}) {
  // Return - A link to the next kbb page after choosing the style.

  var res = null;

  var link = 'https://www.kbb.com/' + make.toLowerCase() + '/' + model.toLowerCase() + '/' + craigs.year + '/styles/?intent=buy-used';
  // console.log(link);

  try {
    var $ = await rp({...OPTIONS, uri: link});
    var styleLinks = $('a.style-link').map((index, elem) => {
      return $(elem).attr('href');
    }).get();

    // TODO: Match style.
    var style = styleLinks[0];
    style = style.replace(/\/options/g, "");
    res = 'https://www.kbb.com' + style + '&pricetype=private-party&condition=good';

    // console.log("styleLinks = ", styleLinks);
  }
  catch(err) {
    console.log("getKbbStyle = ", err);
    return null;
  }

  return res;
}

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
    return null;
  }

  return kbbPrice;
}

async function getKbb(craigs, input) {

  var kbbLink = await getKbbStyle(craigs, input);
  return {kbbPrice: await getKbbPrice(kbbLink), kbbLink}
}

async function requestCache(action, input) {
  var res = null;
  try {
    const options = {
      uri: 'https://q62fhm3rwk.execute-api.us-east-1.amazonaws.com/dev/hello',
      method: 'POST',
      json: true,
      body: {
        action,
        input
      },
      timeout: 2000
    };

    var rsp = await rp(options);
    if(rsp.status !== 'success') {
      throw new Error("Cache request failed");
    }

    if(action === "get" && rsp.res !== null) {
      res = JSON.parse(rsp.res);
    }
  }
  catch(e) {
    console.log("requestCache err for key = ", input.key, e);
    return null;
  }

  return res;
}

async function handleCar(href, input) {

  // First, check the cache.
  var cacheRes = await requestCache("get", {key: href});
  if(cacheRes !== null) {
    return cacheRes;
  }

  var craigs = await getCraigs(href, input);
  var kbb = await getKbb(craigs, input);

  // Calc percentage difference.
  var craigsPrice = parseInt(craigs.price);
  var kbbPrice = parseInt(kbb.kbbPrice);
  var kbbPricePercentage = (craigsPrice / kbbPrice) - 1

  var res = {...craigs, ...kbb, kbbPricePercentage, ...input}

  // Set the result in the cache.
  await requestCache("set", {key: href, value: res});

  return res;
}

module.exports.cars = async (event, context, callback) => {
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

  // Sort
  carsResolved.sort((a,b) => {
    return (a.kbbPricePercentage - b.kbbPricePercentage);
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
