var {damerauLevenshteinDistance} = require('./damerau-levenshtein');
var {makeLogger} = require('./logger');
var {Queue} = require('./Queue');
var {lcsNaive} = require('./lcs');

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

function wrapSrcInsequenceMatch(a, b) {
	a = a.toLowerCase().replace(/\s|-/g, '');
	b = b.toLowerCase().replace(/\s|-/g, '');
	
	var res =  lcsNaive(a, b, SRC_TOKEN_MATCH_THRESHOLD);
	var weight = weightForTokenize(res.count, a, b);
    
    return {weight, ...res};
}

function wrapSrcTokenize(src, inChars, outputWords=true) {
    let logger = makeLogger(false);
    let srcTokens = src.toLowerCase().trim().replace(/-/gi, '').split(/\s+/gi);
    // resIChar, is the number of matched inChars.
    let {matches: matchWords, resIChar} = srcTokenize(srcTokens, inChars.toLowerCase().trim(/\s+/gi), 0, 0, outputWords);
    logger.log("resIChar = ", resIChar);

    // Weight is the matched words by the source words plus the number of inChars not matched.
    let weight = matchWords.length / (srcTokens.length + (inChars.length - resIChar));
    return {weight, matchWords};
}

/*
* Match `src` tokens given `inChars`.
* If some chars are consumed by a source token/word, but don't match given weight, then try to consume the
* target inChars, and try by not consuming.
* parameter src: The source string.
* parameter inChars: The insequence chars match.
* */
const SRC_TOKEN_MATCH_THRESHOLD = .85;
let logger = makeLogger(false);
function srcTokenize(src, inChars, iSrc=0, iChar=0, outputWords=true) {
    let res = [];

    if (iSrc >= src.length || iChar >= inChars.length) {
        return {matches: res, resIChar: iChar};
    }

    let srcWord = src[iSrc];
    let beforeIChar = iChar;
    var sliceInChars = inChars.slice(iChar);
    logger.log("Comparing inChars = ", sliceInChars);
    let subMatch = wrapSrcInsequenceMatch(srcWord, sliceInChars);
    logger.log("subMatch count = ", subMatch.count);
    let matchCount = subMatch.count;
    // End, is the last matching index for sliceInChars
    iChar += subMatch.end;

    var consumeChar = [];
    var resIChar = 0;

    if ((matchCount / srcWord.length) < SRC_TOKEN_MATCH_THRESHOLD) {
        logger.log("Compared with inChars = ", inChars.slice(beforeIChar));
        logger.log("Not a match for srcWord = ", srcWord, ", matchCount = ", matchCount, ", percentage = ", matchCount / srcWord.length);
        // Without consuming inChars.
        var {matches: consumeChar, resIChar} = srcTokenize(src, inChars, iSrc+1, beforeIChar, outputWords);
    } else {

        // With consuming inChars.
        var {matches: consumeChar, resIChar} = srcTokenize(src, inChars, iSrc + 1, iChar, outputWords);

        if (outputWords) {
            res.push(srcWord);
        }
        else {
            res.push(iSrc);
        }
    }

    logger.log(consumeChar);
    return {matches: res.concat(consumeChar), resIChar}
}

// console.log(wrapSrcTokenize("mercedez benz s63", "mercedebenz"));

// console.log(wrapSrcTokenize("2014 Honda Accord 21k miles - 1 Owner - Clean Title - Back-up Camera - Well Kept Sedan", "hondaaccord"));

// Test inchar has misplaced middle char. 
// console.log(wrapSrcTokenize("ab c de", "abcde"));
// console.log(wrapSrcTokenize("C", "Scion"));
// console.log(wrapSrcTokenize("SL-Class SL 550 Roadster 2D ", "cssl550"));
// console.log(wrapSrcTokenize("abc def ghi", "acfghi"));
// Edge case, when there's overlap of 'a', but it's not used for second word :(
// This case should prolly not happen, because if adef matched some target with 'a', then insequenceMatch would be abadfgi.
// console.log(wrapSrcTokenize("abcx adef ghi", "abdfgi"));
// Edge case, there's 'a' overlap, and is able to match
// console.log(wrapSrcTokenize("abcx adef ghi", "adfgi"));

function triWayTokenMerge(source, target) {
    let startTime = new Date();
    let logger = makeLogger(true);
    logger.log();
    logger.log("source = ", source, ", target = ", target);
    let mymatch = wrap(source, target).match;
    logger.log("mymatch = ", mymatch);
    let sourceTokens = wrapSrcTokenize(source, mymatch);
    logger.log("sourceTokens = ", sourceTokens);
    let targetTokens = wrapSrcTokenize(target, mymatch);
    logger.log("targetTokens = ", targetTokens);
    let tokenMatch = wrap(sourceTokens.matchWords.join(''), targetTokens.matchWords.join(''));
    logger.log("tokenMatch = ", tokenMatch);
    let sourceByTokenMerge = wrapSrcTokenize(source, tokenMatch.match, false);
    let weight = sourceByTokenMerge.weight;
    let diff = mymatch.length - tokenMatch.match.length;
    weight /= (diff > 0 ? diff : 1);
    logger.log("merged = ", sourceByTokenMerge);
    console.log("triWayTokenMerge Time: ", new Date() - startTime);
    return {weight, matchWords: sourceByTokenMerge.matchWords};
}

// console.log(triWayTokenMerge("mercedez benz s63", "Mercedes-Benz"));

// console.log(triWayTokenMerge("2014 Honda Accord 21k miles - 1 Owner - Clean Title - Back-up Camera - Well Kept Sedan", "Honda Accord"));

// console.log(triWayTokenMerge("Mercedes-Benz C 63 AMG 507 Edition* Coupe, RARE VEHICLE!! coupe", "Scion"));
// console.log(triWayTokenMerge("GLK-350", "GLK 350 4MATIC Sport Utility 4D"));
// console.log(triWayTokenMerge("mercedes sl 550", "SL-Class SL 550 Roadster 2D"));
// console.log(triWayTokenMerge("e320", "C 320 Sedan 4D"));
// console.log(triWayTokenMerge("Accord LX", "Accord LX-P Sedan 4D"));
// console.log(triWayTokenMerge("Accord LX", "Accord LX Sedan 4D"));
// console.log(triWayTokenMerge("abcd", "ab cd"));
// console.log(triWayTokenMerge("axcd", "abc d"));

// This function doesn't make sense for tokenize weights.
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

    // Penalizes the distance between non matches.
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

function weightForTokenize(count, sWord, tWord) {
    let res = (count*2) / (tWord.length + sWord.length);

    if (res === Infinity) {
        console.log("Found inifinity: sWord = ", sWord, ", tWord = ", tWord, ", count = ", count);
    }

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


module.exports = {tokenizeInsequenceCount: wrapToken, insequenceCount: wrap, srcTokenize: wrapSrcTokenize, triWayTokenMerge};
