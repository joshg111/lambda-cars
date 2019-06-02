var {damerauLevenshteinDistance} = require('./damerau-levenshtein');
var {makeLogger} = require('./logger');
var {Queue} = require('./Queue');
var {lcsNaive} = require('./lcs');
var {newInsequence} = require('./newInsequence');

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
	
	var res =  lcsNaive(a, b, SRC_TOKEN_MATCH_THRESHOLD);
	var weight = weightForTokenize(res.count, a, b);
    
    return {weight, ...res};
}

class TokenMatch {
    constructor(words=[], indexes=[]) {
        this.words = words;
        this.indexes = indexes;
    }

    merge(otherTokenMatch) {
        this.indexes = this.indexes.concat(otherTokenMatch.indexes);
        this.indexes.sort();
        this.words = this.words.concat(otherTokenMatch.words);
    }
    
    toString() {
        return "words = " + this.words.toString() + ", indexes = " + this.indexes.toString();
    }
}

function wrapSrcTokenize(src, inChars) {
    let logger = makeLogger(false);
    let srcTokens = src.toLowerCase().trim().replace(/-/gi, '').split(/\s+/gi);
    // resIChar, is the number of matched inChars.
    let res = srcTokenize(srcTokens, inChars.toLowerCase().trim(/\s+/gi), 0, 0);
    res.words.reverse();
    res.indexes.reverse();
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
const SRC_TOKEN_MATCH_THRESHOLD = .85;
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
    // End, is the last matching index for sliceInChars
    iChar += subMatch.end;

    if ((matchCount / srcWord.length) > SRC_TOKEN_MATCH_THRESHOLD) {
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
    for (const matchIndex of matchIndexes.reverse()) {
        sArr.splice(matchIndex, 1);
    }
    return sArr.join(' ');
}

function triWayTokenMerge(source, target) {
    let startTime = new Date();
    let logger = makeLogger(false);
    var res = {weight: 0, sourceTokenMatch: new TokenMatch()};

    var tokenMerge1 = _triWayTokenMerge(source, target);
    if (tokenMerge1.length === 0) {
        return res;
    }
    let sourceTokenMatch = wrapSrcTokenize(source, tokenMerge1);
    let targetTokenMatch = wrapSrcTokenize(target, tokenMerge1);

    if (sourceTokenMatch.indexes.length > 0) {
        var tokenMerge2 = _triWayTokenMerge(removeMatchFromSources(source, sourceTokenMatch.indexes),
                                            removeMatchFromSources(target, targetTokenMatch.indexes));
        let sourceTokenMatch2 = wrapSrcTokenize(source, tokenMerge2);
        sourceTokenMatch.merge(sourceTokenMatch2);
    }
    
    let weight = (sourceTokenMatch.words.join(" ").length) / (source.length);
    
    // Doing the following calculation helps us weigh in favor of either higher token match or lower mymatch.
    // Both of which favor matches with less noise. 
    // However, it's not clear how less noise translates to a better rank, and it's causing the algorithm 
    // to favor certain matches over others arbitrarily when there's no real distinction, therefore removing for now.
    // let diff = mymatch.length - tokenMatch.match.length;
    // weight /= (diff > 0 ? diff : 1);
    // We could try tokenMatch.match.length / (source.length + target.length)

    logger.log();
    logger.log("source = ", source, ", target = ", target);
    logger.log("sourceTokenMatch = ", sourceTokenMatch);
    logger.log("weight = ", weight, ", merged = ", sourceTokenMatch.indexes);
    logger.log("triWayTokenMerge Time: ", new Date() - startTime);
    // return {weight, sourceTokenMatch, targetTokenMatch};
    return {weight, sourceTokenMatch};
}

function _triWayTokenMerge(source, target) {
    let logger = makeLogger(false);

    var res = "";
    let mymatch = newInsequence(source, target).match;
    
    let sourceTokens = wrapSrcTokenize(source, mymatch);
    
    // Break early
    if (sourceTokens.words.length === 0) {
        return res;
    }
    let targetTokens = wrapSrcTokenize(target, mymatch);
    // Break early
    if (targetTokens.words.length === 0) {
        return res;
    }

    logger.log("source = ", source, ", target = ", target);
    logger.log("mymatch = ", mymatch);
    logger.log("sourceTokens = ", sourceTokens);
    logger.log("targetTokens = ", targetTokens);

    let tokenMerge = newInsequence(sourceTokens.words.join(''), targetTokens.words.join(''));
    logger.log("tokenMerge = ", tokenMerge);
    
    return tokenMerge.match;
}


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
