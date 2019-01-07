var {damerauLevenshteinDistance} = require('./damerau-levenshtein');


var WORD_COUNT_THRESHOLD = .6;


function wrapToken(a, b) {
	a = a.toLowerCase();
	b = b.toLowerCase();

	var aSplit = a.trim().split(" ");
	var bSplit = b.trim().split(" ");

	var cache = {};
	var indicies = {source: new Set([...Array(aSplit.length).keys()]), target: new Set([...Array(bSplit.length).keys()])}
	// I don't want to weight the tokenization rank sum with the number of target tokens.
	// That would penalize targets with more tokens.
	var res = tokenize(aSplit, bSplit, indicies, cache) / bSplit.length;
	console.log("wrapToken res = ", res, ", source = ", a, ", target = ", b);
	return res;
	// return tokenize(aSplit, bSplit, indicies, cache);
}

function weighMatchCount(count, sWord, tWord) {
	// var res = ((count / sWord.length) + (count / tWord.length)) / 2;
	var res = count / (Math.max(sWord.length, tWord.length) - count);
	res = (isNaN(res) ? 0 : res);
	return res;
}

/**
* source: A list of source words.
* target: A list of target words.
**/
function tokenize(source, target, indicies, cache) {
	if (indicies.source.size === 0 || indicies.target.size === 0) {
		return 0;
	}

	if (indicies in cache) {
		// console.log("Found in cache");
		return cache[indicies];
	}


	var targetI = indicies.target.values().next().value;
	var targetWord = target[targetI];
	var newTargetSet = new Set(indicies.target);
	newTargetSet.delete(targetI);
	var newI = {target: newTargetSet, source: indicies.source};
	var maxList = [];

	// The case when no source is consumed for a given target word.
	// That makes this targetWord 0.
	maxList.push(tokenize(source, target, newI, cache));
	for (var i of indicies.source) {
		var leven = wrap(source[i], targetWord);
		var tempMax = weighMatchCount(leven, source[i], targetWord);
		tempMax = (tempMax >= WORD_COUNT_THRESHOLD) ? tempMax : 0;

		var newSourceI = new Set(indicies.source)
		newSourceI.delete(i);
		newI.source = newSourceI;
		maxList.push(tempMax + tokenize(source, target, newI, cache));
	}

	var maxCount = Math.max(...maxList);
	cache[indicies] = maxCount;

	return maxCount;
}

// console.log(wrapToken("c 250 sport sedan 4d", "c250 turbo navy fed"));

// console.log(wrapToken("2016 Mercedes-Benz S-Class S550", "S 550 Sedan 4D"));
// console.log(wrapToken("2016 Mercedes-Benz S-Class S550", "S 550e Plug Hybrid Sedan 4D"), "\rn\rn **********************");


function wrap(a, b) {
	var cache = {}
	a = a.toLowerCase();
	b = b.toLowerCase();
	// console.log("source = ", a, "target = ", b);
	return insequenceMatch(a, b, 0,0, cache)[0]
}


function insequenceMatch(a, b, i, j, cache) {

	if (i >= a.length || j >= b.length) {
		return [0, ""]
	}

	if ([i,j] in cache) {
		return cache[[i,j]]
	}

	if (a[i] == b[j]) {
		var [count, match] = insequenceMatch(a, b, i+1, j+1, cache)
		count += 1
		match = a[i] + match
	}

	else {

		var first = insequenceMatch(a, b, i, j+1, cache)
		var second = insequenceMatch(a, b, i+1, j, cache)
		if (first[0] > second[0]) {
			var [count, match] = first
		}
		else {
			var [count, match] = second
		}
	}

	cache[[i,j]] = [count, match]
	// console.log([count, match, i, j])
	return [count, match]
}

// console.log(wrap("abcef", "abdef"));
// console.log(wrap("Low miles 26,650 2017 Honda Accord EXL  start.4 cylinder 2,4 engine", "fdfcdde"));
// console.log(wrap("c 250 sport sedan 4d", "c250 turbo navy fed"));
// console.log(wrap("350", "2009  E350 Sports Pkg AMG wheels"));
// console.log(wrap("amg", "2009  E350 Sports Pkg AMG wheels"));


module.exports = {insequenceCount: wrapToken};
