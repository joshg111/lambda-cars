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
    var res = tokenize(aSplit, bSplit, indicies, cache)
	res["weight"] = res.count / bSplit.length;
	// console.log("wrapToken res = ", res, ", source = ", a, ", target = ", b);
	return res;
	// return tokenize(aSplit, bSplit, indicies, cache);
}

/**
* source: A list of source words.
* target: A list of target words.
**/
function tokenize(source, target, indicies, cache) {
	if (indicies.source.size === 0 || indicies.target.size === 0) {
		return {count: 0, sources: []};
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
	// That makes this targetWord 0. Basically we skip the targetWord?
	maxList.push(tokenize(source, target, newI, cache));
	for (var i of indicies.source) {
		var tempMax = wrap(source[i], targetWord).weight;
		// var tempMax = weighMatchCount(leven, source[i], targetWord);
		tempMax = (tempMax >= WORD_COUNT_THRESHOLD) ? tempMax : 0;
		var newSourceI = new Set(indicies.source)
		newSourceI.delete(i);
		newI.source = newSourceI;
        let recursiveRes = tokenize(source, target, newI, cache)
		maxList.push({count: tempMax + recursiveRes.count, sources: recursiveRes.sources.concat([source[i]])});
	}

    // Math.max(...maxList);
	var maxRes = maxList.reduce((accumulator, curr) => {
		if (curr.count > accumulator.count) {
			return curr;
		}
		return accumulator;
	});
	cache[indicies] = maxRes;

	return maxRes;
}

// console.log(wrap("2012 ml350 sport utility 4matic suv white", "ML 350 4MATIC Sport Utility 4D"));
// console.log(wrap("2012 ml350 sport utility 4matic suv white", "GLK 350 4MATIC Sport Utility 4D"));
// console.log(wrapToken("c 250 sport sedan 4d", "c250 turbo navy fed"));


// console.log(wrapToken("mercedes benz", "mercedes-benz"));
// console.log(wrapToken("dexxf ghi abc", "abc def ghi"));
// console.log(wrapToken("2016 Mercedes-Benz S-Class S550", "S 550 Sedan 4D"));
// console.log(wrapToken("2016 Mercedes-Benz S-Class S550", "S 550e Plug Hybrid Sedan 4D"), "\rn\rn **********************");


function wrap(a, b) {
	var cache = {};
	a = a.toLowerCase().replace(/\s|-/g, '');
	b = b.toLowerCase().replace(/\s|-/g, '');
	// console.log("source = ", a, "target = ", b);
	var res =  insequenceMatch(a, b, 0,0, cache, null);
	var weight = weighMatchCount(res[0], res[1], a, b);
    // console.log("weight = ", weight, ", count = ", res[0], ", match = ", res[1]);
    return {weight, match: res[1]};
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

		var first = insequenceMatch(a, b, i, j+1, cache);
		var second = insequenceMatch(a, b, i+1, j, cache);
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

function weighMatchCount(count, match, sWord, tWord) {
    // var res = ((count / sWord.length) + (count / tWord.length)) / 2;
    // var res = count / (Math.max(sWord.length, tWord.length) - count);
    if (count === 0 || match.length === 0) {
        return 0;
    }

    let maxLength = Math.max(sWord.length, tWord.length);

    // Favor matches that start closer to the beginning.
    for (let i = 0; i < tWord.indexOf(match[0]); i++) {
        // count -= valuePerChar;
        count /= 2;
        // console.log("adjust for prefix, count = ", count);
    }

    var valuePerChar = count / maxLength;
    for (let i = 0; i < sWord.indexOf(match[0]); i++) {
        count -= valuePerChar;
        // count /= 2;
        // console.log("adjust for prefix, count = ", count);
    }

    let startIndex = 0;
    for (let c of [...match]) {
        let fromIndex = tWord.indexOf(c, startIndex);
        if ((fromIndex - startIndex) > 1) {
            count -= 1;
            // count /= 2;
            // console.log("adjust for distance, count = ", count);
        }
        startIndex = fromIndex;
    }
    startIndex = 0;
    for (let c of [...match]) {
        let fromIndex = sWord.indexOf(c, startIndex);
        if ((fromIndex - startIndex) > 1) {
            count -= 1;
            // count /= 2;
        }
        startIndex = fromIndex;
    }

    let res = (count*2) / (tWord.length + sWord.length);

    if (res === Infinity) {
        console.log("Found inifinity: sWord = ", sWord, ", tWord = ", tWord, ", count = ", count);
    }
    // console.log("sWord = ", sWord, ", tWord = ", tWord, ", count = ", count, ", res = ", res);
    res = (isNaN(res) || res === Infinity || res < 0 ? 0 : res);
    return res;
}

// console.log(wrap("Class G 500", "C 350 Sedan 4D"));
// console.log(wrap("Class G 500", "G 500 Sport Utility 4D"));
// console.log(wrap("G-Class G 500 HEATED/POWER SEATS", "C 350 Sedan 4D"));
// console.log(wrap("G-Class G 500 HEATED/POWER SEATS", "G 500 Sport Utility 4D"));

// console.log(wrap("dexxxxf", "def"));
// console.log(wrap(" 2013  sl63 ", " c 250 coupe 2d"));
// console.log(wrap("1993 300 ce", "cabriolet 2d"));
// console.log(wrap("1993 300 ce", "asdfcabriolet 2d"));
// console.log(wrap("abcef", "abdef"));
// console.log(wrap("Low miles 26,650 2017 Honda Accord EXL  start.4 cylinder 2,4 engine", "fdfcdde"));
// console.log(wrap("c 250 sport sedan 4d", "c250 turbo navy fed"));
// console.log(wrap("350", "2009  E350 Sports Pkg AMG wheels"));
// console.log(wrap("amg", "2009  E350 Sports Pkg AMG wheels"));


module.exports = {tokenizeInsequenceCount: wrapToken, insequenceCount: wrap};
