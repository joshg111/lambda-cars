var cheerio = require('cheerio'); // Basically jQuery for node.js
var rp = require('request-promise');
const fs = require('fs');


async function mr() {
  var options = {
      uri: 'https://geo.craigslist.org/iso/us',
      transform: function (body) {
          return cheerio.load(body);
      }
  };

  try {
    var $ = await rp(options);
    var cars = []
    $('ul.geo-site-list li a').attr('href',
      (i, e) => {
        // console.log(i, e);

        cars.push('\''+e.match(/https:\/\/(.*?).craigslist/i)[1] + '\'');
      })

    console.log(cars);

    fs.writeFile("/tmp/craigsLocations", cars, function(err) {
        if(err) {
            return console.log(err);
        }

        console.log("The file was saved!");
    });

  }
  catch(err) {
    console.log("err = ", err);
  }

  return $;
}

mr();
