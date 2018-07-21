

// function delay(t, v) {
//    return new Promise(function(resolve) {
//        setTimeout(resolve.bind(null, v), t)
//    });
// }

async function delay(t, v) {
   await setTimeout(()=>{}, t);
   return v;
}

async function a() {
  var b =[delay(1000, 1),delay(1000, 1),delay(1000, 1),delay(1000, 1)];
  console.log(b);
  var d = await Promise.all(b);
  console.log(d);
  console.log(d[0] ===1);

}
var c = a();

delay(1000, 1).then((v) => {
  console.log(v)
});
