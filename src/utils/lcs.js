
/**
 * 
 * @param {source} a 
 * @param {target} b 
 * @param {percentage of source to be a match} matchingPercentage 
 * @returns {count: the number of matching characters, start: the target index, end: target index}
 */
function lcsNaive(a, b, matchingPercentage) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  var res = {count: 0, start: 0, end: 0};
  
  for(var i = 0; i < a.length; i++) {
    for(var j = 0; j < b.length; j++) {
      for(var k = 0; (i+k) < a.length && (j+k) < b.length && a[i+k] === b[j+k]; k++) {
        var newCount = k + 1;
        if(newCount > res.count) {
          res = {count: newCount, start: j, end: j+newCount};
        }
      }
      if((res.count / a.length) >= matchingPercentage) {
        // Short circuit
        break;
      }
    }
  }

  return res;
}

// console.log(lcsNaive("accord", "aaccord", .9));


function findLcsDpNew(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  var arr = [];
  for(var i = 0; i < a.length+1; i++) {
    arr.push(0);
  }

	var max_len = 0
	var res = ''

	for(var j = 0; j < b.length; j++) {
    var be = b[j];

		for(var i = a.length; i > 0; i--) {
			index = i - 1
			e = a[index]
			if(e == be) {
				arr[i] = arr[i-1] + 1
				if(arr[i] > max_len) {
					max_len = arr[i]
					res = a.substring(i-arr[i], i);
        }
      }
      else {
        arr[i] = 0;
      }
    }
  }

	console.log(res, max_len);
	return max_len
}

// findLcsDpNew("abcdzefg", "abcdxefg");
// findLcsDpNew('1999 Chevy Suburban Suv, Low Miles, New Tires, 3rd Row, Just Smog\'d', 'chevrolet');
// findLcsDpNew('Volvo', 'mercedes benz gl450');


module.exports = {lcs: findLcsDpNew, lcsNaive};
