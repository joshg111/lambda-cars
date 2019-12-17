const pConfig = require("../../../../public-config");
var rp = require('request-promise');

const USER_AGENT = pConfig.rp.USER_AGENT;
const KBB_PRICE_RETRY_COUNT = 2;
async function getKbbPrice(matchLink, craigs, retryCount=0) {
  console.log("getKbbPrice retry = ", retryCount);


  var link = getKbbLink(matchLink, craigs);
  var kbbPrice = null;

  var options = {
      uri: link,
      headers: getHeaders(),
    timeout: 6000
  };

  var body;
  try {
    body = await rp(options);
    var parsed = JSON.parse(body);
    kbbPrice = parsed.data.apiData.vehicle.values[2].value;

  }
  catch(err) {
    if (retryCount < KBB_PRICE_RETRY_COUNT) {
        return await getKbbPrice(matchLink, craigs, retryCount + 1);
    }
    console.log("getKbbPrice err = ", err);
    // throw new Error(err);
    return Promise.reject(err);
  }

  return kbbPrice;
}

function getMileage(year) {
  var d = new Date();
  var currentYear = d.getFullYear();
  var diff = currentYear - year;
  return diff > 0 ? (diff * 12000) : 0;
}

function getKbbLink(matchLink, craigs) {
  var kbbLink = "https://www.kbb.com/Api/3.9.395.0/70134/vehicle/upa/PriceAdvisor/meter.json?action=Get&intent=buy-used&pricetype=Private%20Party&zipcode=92101&hideMonthlyPayment=True&condition=good";
  
  var vehicleId = /vehicleid=([^&]*)/g.exec(matchLink)[1];
  
  kbbLink += "&vehicleid=" + vehicleId;
  kbbLink += "&mileage="
  kbbLink += craigs.odometer ? craigs.odometer : getMileage(parseInt(craigs.year, 10));
  console.log("kbbLink = ", kbbLink);
  return kbbLink;
}

function getHeaders() {

  return {
    'user-agent': USER_AGENT,
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-US,en;q=0.9',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'cookie': 'pxa_id=c5vtfDKLt5GDg5r83dIPolGL; BIRF_Audit=true; pxa_realid=c5vtfDKLt5GDg5r83dIPolGL; pxa_at=true; AWSELB=4F81CB4516F2E50145514F5CB6B69E74FA159B9B648E81019A1EDA867CA07BF2D1A80E4440B1A21A4D4083CC7C1986FB03EB5D7D7F2746F79574370E8FFADE9D5E7CFA83DE; ak_bmsc;'
  }
}

module.exports = {getKbbPrice};