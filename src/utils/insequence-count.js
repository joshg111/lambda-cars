var {damerauLevenshteinDistance} = require('./damerau-levenshtein');
var {makeLogger} = require('./logger');
var {Queue} = require('./Queue');
var {lcsNaive} = require('./lcs');
var {newInsequence} = require('./newInsequence');
var {findSourceTokens} = require('./tokenMatcher');
var {TokenMatch} = require('../model/TokenMatch');
var {TokenList} = require('../model/TokenList');

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

// console.log(wrap('CLS500 MILITARY 0 DOWN NAVY FED', 'CLS 500 Coupe 4D'));
// console.log(wrap('CLS CLS500 MILITARY 0 DOWN NAVY FED', 'CLS Class CLS 500 Coupe 4D'));

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
	console.log("source = ", a, "target = ", b);
	var res =  insequenceMatch(a, b, 0,0, cache);
    var weight = weighMatchCount(res.count, res.match, a, b);
    res.sourcePath.sort((i,j) => (i-j));
    // console.log("weight = ", weight, ", count = ", res[0], ", match = ", res[1]);
    return {weight, ...res};
}

function insequenceMatch(a, b, i, j, cache) {

    var res = {count: 0, match: "", start: 0, end: 0};

	if (i >= a.length || j >= b.length) {
        return {count: 0, match: "", start: 0, end: 0, sourcePath: []};
	}

	// if ([i,j] in cache) {
	// 	return cache[[i,j]]
	// }

	if (a[i] == b[j]) {
        res = insequenceMatch(a, b, i+1, j+1, cache);
        if (res.count == 0) {
            res.end = i;
        } else {
            res.start = i;
        }
		res.count += 1;
        res.match = a[i] + res.match;
        res.sourcePath.push(i);
        console.log("match = ", res.match, ", i = ", i, ", j = ", j);
        console.log("sourcePath = ", res.sourcePath);
	} else {
        console.log("other = ", res.match, ", i = ", i, ", j = ", j);
		var first = insequenceMatch(a, b, i, j+1, cache);
		var second = insequenceMatch(a, b, i+1, j, cache);
		if (first.count > second.count) {
			res = first;
		} else {
			res = second;
        }
        
	}

    // res = Object.assign({}, res);
	cache[[i,j]] = {...res};
	return {...res};
}

function wrapSrcInsequenceMatch(a, b) {
	a = a.toLowerCase().replace(/\s|-/g, '');
	b = b.toLowerCase().replace(/\s|-/g, '');
	
    // var res =  lcsNaive(a, b, SRC_TOKEN_MATCH_THRESHOLD);
    var res =  newInsequence(a, b);
	var weight = weightForTokenize(res.count, a, b);
    
    return {weight, ...res};
}

function wrapSrcTokenize(src, inChars) {
    let logger = makeLogger(false);
    // let srcTokens = src.toLowerCase().trim().replace(/-/gi, '').split(/\s+/gi);
    // resIChar, is the number of matched inChars.
    // let res = srcTokenize(srcTokens, inChars.toLowerCase().trim(/\s+/gi), 0, 0);
    let res = findSourceTokens(src, inChars);
    // res.words.reverse();
    // res.indexes.reverse();
    logger.log("res = ", res);

    return res;
}

/*
* Match `src` tokens given `inChars`.
* If some chars are consumed by a source token/word, but don't match given weight, then try to consume the
* target inChars, and try by not consuming.
* parameter src: The source string.
* parameter inChars: The insequence chars match.
* */
const SRC_TOKEN_MATCH_THRESHOLD = .79;
let logger = makeLogger(false);
function srcTokenize(src, inChars, iSrc=0, iChar=0) {
    let res;

    if (iSrc >= src.length || iChar >= inChars.length) {
        return new TokenMatch();
    }

    let srcWord = src[iSrc];
    let beforeIChar = iChar;
    var sliceInChars = inChars.slice(iChar);
    logger.log("Comparing inChars = ", sliceInChars);
    let subMatch = wrapSrcInsequenceMatch(srcWord, sliceInChars);
    logger.log("subMatch count = ", subMatch.count);
    let matchCount = subMatch.count;
    // let subWeight = (matchCount * 2) / (srcWord.length + sliceInChars.length);
    // logger.log('subWeight = ', subWeight);
    // End, is the last matching index for sliceInChars
    // iChar += subMatch.end;
    iChar += matchCount;

    if ((matchCount / srcWord.length) > SRC_TOKEN_MATCH_THRESHOLD) {
    // if (subWeight > SRC_TOKEN_MATCH_THRESHOLD) {
        logger.log("Found a match for srcWord = ", srcWord, ", matchCount = ", matchCount, ", percentage = ", matchCount / srcWord.length);
    
        // With consuming inChars.
        var resA = srcTokenize(src, inChars, iSrc + 1, iChar);
        logger.log("resA = ", resA);
    }

    // The case when we want to skip this match all together, and not consume anything.
    var resB = srcTokenize(src, inChars, iSrc + 1, beforeIChar);
    logger.log("resB = ", resB);
    if (resA && (resA.words.join('').length + srcWord.length) > resB.words.join('').length) {
        res = resA;
        res.words.push(srcWord);
        res.indexes.push(iSrc);
    } else {
        res = resB;
    }

    logger.log("res = ", res);
    return res;
}


// console.log(wrapSrcTokenize('CLS CLS500 MILITARY 0 DOWN NAVY FED', 'clscls500oed'));
// console.log(wrapSrcTokenize('CLS Class CLS 500 Coupe 4D', 'clscls500oed'));

// console.log(wrapSrcTokenize('7 Series 750Li Sedan 4D', '750lisedan'));
// console.log(wrapSrcTokenize('3 Series 335d Sedan 4D', '335d'));
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

function removeMatchFromSources(s, matchIndexes) {
    let sArr = s.split(/\s+/gi);
    // Reverse sort so we can remove from back of array first.
    matchIndexes.sort((a, b) => b - a);
    for (const matchIndex of matchIndexes) {
        sArr.splice(matchIndex, 1);
    }
    return sArr.join(' ');
}

function triWayTokenMerge(source, target) {
    let startTime = new Date();
    let logger = makeLogger(true);
    let weight = 0;
    var {sourceTokens, targetTokens} = _triWayTokenMerge(source, target);
    weight = (sourceTokens.averageWeight() + targetTokens.averageWeight()) / 2;

    logger.log();
    logger.log("source = ", source, ", target = ", target);
    logger.log("sourceTokens = " + sourceTokens);
    logger.log("targetTokens = " + targetTokens);
    logger.log("weight = ", weight);
    logger.log("triWayTokenMerge Time: ", new Date() - startTime);
    // return {weight, sourceTokenMatch, targetTokenMatch};
    return {weight, sourceTokens};
}

function _reduceTokens(source, target, sourceWords, targetWords) {
    let logger = makeLogger(false);

    var sourceTokens = wrapSrcTokenize(source, targetWords);
    logger.log("sourceTokens = ", sourceTokens);
    var targetTokens = wrapSrcTokenize(target, sourceWords);
    logger.log("targetTokens = ", targetTokens);
    // merge = newInsequence(sourceTokens.words.join(''), targetTokens.words.join('')).match;
    // logger.log("tokenMerge = ", merge);

    return {sourceTokens, targetTokens};
}

/**
 * Repeatedly finds tokens and merges them until the merges match ie. the tokens are unchanged.
 * Need a way to remove noisy tokens. When tokens are found, but later they do not persist after reducing, 
 * then we know those are noisy tokens. Save the tokens that are found eg. the TokenMatch object.
 * Could continuously save the previous TokenMatch objects, then take the set difference of the previous and 
 * remove the resulting indexes from the string. Then, rerun until there's no more set difference.
 * @param {Source string} source 
 * @param {Target string} target 
 */
function _triWayTokenMerge(source, target) {
    let logger = makeLogger(false);
    logger.log();
    logger.log("_triWayTokenMerge");
    logger.log("source = ", source, ", target = ", target);
    let prevSourceTokens = {};
    var {sourceTokens, targetTokens} = _reduceTokens(source, target, source, target);

    while (!(sourceTokens.joinMatch() in prevSourceTokens)) {
    // for (let i = 0; i < 2; i++) {
        prevSourceTokens[sourceTokens.joinMatch()] = 1;
        var {sourceTokens, targetTokens} = 
            _reduceTokens(source, target, sourceTokens.joinMatch(), targetTokens.joinMatch());
    }
    
    return {sourceTokens, targetTokens};
}


// triWayTokenMerge("BMW 528i V6 65,000 miles No accidents, Excellent Condition, Luxurious! sedan",
// "X5 xDrive35i Sport Activity Sport Utility 4D");

// triWayTokenMerge('E300 - Loaded! ASSUME MY $594 LEASE x 10 MONTHS! sedan', 'Sprinter 3500 XD Cargo Standard Roof w/144" WB Van 3D');
// console.log(triWayTokenMerge('E Class', 'E Class E 300 4MATIC Sedan 4D'));
// console.log(triWayTokenMerge('E300 sedan', 'E 300 Sedan'));
// console.log(triWayTokenMerge('ML 350 SUV', 'M Class ML 350 4MATIC Sport Utility 4D'));

// console.log(triWayTokenMerge('Mercedes SLK 230 convertible', 'Mercedes-Benz'));

// console.log(triWayTokenMerge('X3 35i', 'X3 XDrive35i Sport Utility 4D'));
// console.log(triWayTokenMerge('x3 35i', '3 Series 335i Convertible 2D'));

// This results in noisy tokens which causes no match.
// console.log(triWayTokenMerge('335is Convertible convertible', '3 Series 335is'));


// console.log(triWayTokenMerge('335is Convertible convertible', '3 Series 335is Convertible 2D'));

// console.log(triWayTokenMerge('x3 3.0i', 'X3 3.0si Sport Utility 4D'));

// console.log(triWayTokenMerge('CLS CLS500 MILITARY 0 DOWN NAVY FED', 'CLS Class CLS 500 Coupe 4D'));

// Coupe is out of order.
// console.log(triWayTokenMerge('AMG GLE 43 4MATIC Coupe', 'Mercedes AMG GLE Coupe GLE 43 Sport Utility 4D'));

// console.log(triWayTokenMerge('7 Series 750Li Sedan 4D', '750lisedan'));

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
