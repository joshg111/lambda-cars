

function findLcsDpNew(a, b) {
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
    }
  }

	console.log(res, max_len);
	return max_len
}

// findLcsDpNew("abcdzefg", "abcdxefg");

module.exports = {lcs: findLcsDpNew};
