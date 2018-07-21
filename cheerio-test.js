var cheerio = require('cheerio'); // Basically jQuery for node.js
var rp = require('request-promise');

async function mr() {
  var options = {
      uri: 'https://sandiego.craigslist.org/search/cto?sort=pricedsc&srchType=T&hasPic=1&bundleDuplicates=1&min_price=0&max_price=20000&auto_make_model=toyota+camry&auto_title_status=1',
      transform: function (body) {
          return cheerio.load(body);
      }
  };

  try {
    var $ = await rp(options);
    var cars = []
    $('ul.rows a.result-image').attr('href',
      (i, e) => {
        // console.log(i, e);
        cars.push(e);
      })
    console.log(cars);

  }
  catch(err) {
    console.log("err = ", err);
  }

  return $;
}

mr();
