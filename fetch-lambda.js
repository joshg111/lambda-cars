var rp = require('request-promise');

const CARS = {
  uri: 'https://q62fhm3rwk.execute-api.us-east-1.amazonaws.com/dev/cars',
  method: 'POST',
  json: true
};

const OPTIONS = {
  uri: 'https://q62fhm3rwk.execute-api.us-east-1.amazonaws.com/dev/hello',
  method: 'POST',
  json: true
};

// rp({...OPTIONS, body: {
//   action: "set",
//   input: {key: 'abc', value: '{a: "1", b: "2"}'}
// }}).then((rsp) => {
//   console.log("rsp = ", rsp);
//   console.log(rsp.status === 'success');
//
//   rp({...OPTIONS, body: {
//     action: "get",
//     input: {key: 'abc'}
//   }}).then((rsp) => {
//     console.log("rsp = ", rsp);
//   })
// })

rp({...CARS, body: {
  make: 'toyota', model: 'camry'
}}).then((rsp) => {
  console.log(rsp);
});


// var request = require('request');
//
// var body = JSON.stringify({ action: "set", input: { key: 'abc', value: "123" } });
//
// request(
//     {
//       method: 'POST',
//       url: 'https://q62fhm3rwk.execute-api.us-east-1.amazonaws.com/dev/hello',
//       body
//     },
//     function (error, response, body) {
//         if (!error && response.statusCode == 200) {
//             console.log(body)
//         }
//         body = JSON.stringify({ action: "get", input: { key: 'abc' } });
//         request(
//             {
//               method: 'POST',
//               url: 'https://q62fhm3rwk.execute-api.us-east-1.amazonaws.com/dev/hello',
//               body
//             },
//             function (error, response, body) {
//                 if (!error && response.statusCode == 200) {
//                     console.log(body)
//                 }
//             }
//         );
//     }
// );
