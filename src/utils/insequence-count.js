function insequenceMatch(a, b, i, j, count) {

	if (i >= a.length || j >= b.length) {
		return count
	}

	if (a[i] == b[j]) {
		count += 1
		count = insequenceMatch(a, b, i+1, j+1, count)
	}
	else {
		count = Math.max(insequenceMatch(a, b, i, j+1, count), insequenceMatch(a, b, i+1, j, count))
	}

	return count;
}

function match(a, b) {
	console.log(a, b);
  return insequenceMatch(a, b, 0, 0, 0)
}

console.log(match("Low miles 26,650 2017 Honda Accord EXL  start.4 cylinder 2,4 engine", "fdfcdde", 0, 0, 0));

module.exports = {insequenceCount: match};
