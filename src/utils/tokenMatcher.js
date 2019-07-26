var {makeLogger} = require('./logger');
var {newInsequence} = require('./newInsequence');
var {TokenMatch} = require('../model/TokenMatch');
var {TokenList} = require('../model/TokenList');

function toShortStr(s) {
    return s.toLowerCase().replace(/\s|-/g, ' ');
}

function getTokens(s) {
    // Instead of replacing hyphen with empty string, we could use a space, but if we do that then we wont be able to remove the 
    // matched word/s with the indexes we return.
    return s.toLowerCase().trim().replace(/-/gi, '').split(/\s+/gi);
}

// function findSourceTokensPath(source, target) {
//     let startTime = new Date();
//     let logger = makeLogger(false);
//     var sourceTokens = getTokens(source);
//     var shortTarget = toShortStr(target);
//     logger.log(sourceTokens, shortTarget);
//     var res = _findSourceTokensPath(sourceTokens, shortTarget, 0);
//     res.words.reverse();
//     res.indexes.reverse();
//     logger.log("findSourceTokens Time: ", new Date() - startTime);
//     return res;
// }

function findSourceTokens(source, target) {
    let startTime = new Date();
    let logger = makeLogger(false);
    var sourceTokens = getTokens(source);
    var shortTarget = toShortStr(target);
    logger.log(sourceTokens, shortTarget);
    var res = _findSourceTokens(sourceTokens, shortTarget);
    logger.log("findSourceTokens Time: ", new Date() - startTime);
    return new TokenList(res);
}

/**
 * Iterates over sourceTokens and finds the insequence match using
 * the whole target instead of removing from the target. For each
 * insequence we check if it's more than 30% of the original token
 * then we annotate the token with the match.
 */
var THRESHOLD = .3;
function _findSourceTokens(sourceTokens, shortTarget) {

    let res = [];
    for (sourceToken of sourceTokens) {
        var subMatch = newInsequence(sourceToken, shortTarget);
        var weight = subMatch.count / sourceToken.length;
        res.push({sourceToken, weight, match: subMatch.match});
    }

    return res;
}


const SRC_TOKEN_MATCH_THRESHOLD = .87;
let logger = makeLogger(false);
function _findSourceTokensPath(sourceTokens, shortTarget, iSource) {
    logger.log("sourceTokens = ", sourceTokens);
    logger.log("shortTarget = ", shortTarget);
    var res;

    if (iSource >= sourceTokens.length || shortTarget.length === 0) {
        return new TokenMatch();
    }

    logger.log("iSource = ", iSource);
    var currToken = sourceTokens[iSource];
    logger.log("currToken = ", currToken);
    var subMatch = newInsequence(currToken, shortTarget);
    // logger.log("subMatch = ", subMatch);
    var subWeight = ((subMatch.count * 2) / (currToken.length + (subMatch.end - subMatch.start) + 1));
    // var subWeight = ((subMatch.count * 2) / (sourceTokens.join(' ').length + (subMatch.end - subMatch.start) + 1));
    
    if (subWeight > SRC_TOKEN_MATCH_THRESHOLD) {
        logger.log("\nFound match = ", subMatch, ", weight = ", subWeight);
        var newShortTarget = shortTarget.slice(0, subMatch.start) + shortTarget.slice(subMatch.end+1);
        var resA = _findSourceTokensPath(sourceTokens, newShortTarget, iSource + 1);
    }

    var resB = _findSourceTokensPath(sourceTokens, shortTarget, iSource + 1);

    var averageWeight = resA && ((subWeight + resA.weight) / (resA.weight > 0 ? 2 : 1));
    if (resA) {
        logger.log("\nresA = ", resA);
        logger.log("resB = ", resB);
        logger.log("subWeight = ", subWeight, "subMatch = ", subMatch, ", average weight = ", averageWeight);
    }
    
    if (resA && ((resA.count + subMatch.count) > resB.count)) {
        
        res = resA;
        res.words.push(currToken);
        res.indexes.push(iSource);
        // Not sure if we want to do this, but I just don't want to favor more word matches if it brings down the average word weight.
        res.weight = averageWeight;
        res.count += subMatch.count;
    } else {
        res = resB;
    }

    // resMax = [resMax, res].sort((a, b) => b.weight - a.weight)[0]

    return res;
}

// console.log(findSourceTokens('E300 - Loaded! ASSUME MY $594 LEASE x 10 MONTHS! sedan', 'Sprinter 3500 XD Cargo Standard Roof w/144" WB Van 3D'))

// console.log(findSourceTokens('E Class', 'E Class E 300 4MATIC Sedan 4D'));
// console.log(findSourceTokens('E Class E 300 4MATIC Sedan 4D', 'E Class'));
// console.log(findSourceTokens('a abcdefghijklmn', 'abcdefghijklmn'));
// console.log(findSourceTokens('E300 sedan', 'E 300 Sedan'));
// console.log(findSourceTokens('E 300 Sedan', 'E300 sedan'));
// console.log(findSourceTokens('M Class ML 350 4MATIC Sport Utility 4D', 'ML 350 SUV'));
// console.log(findSourceTokens('ML 350 SUV', 'M Class ML 350 4MATIC Sport Utility 4D'));
// console.log(findSourceTokens('X3 35i', 'X3 XDrive35i Sport Utility 4D'));
// console.log(findSourceTokens('3 series 335is', '335is Convertible convertible'));
// console.log(findSourceTokens('335is Convertible convertible', '3 Series 335is'));
// console.log(findSourceTokens('3 Series 335d Sedan 4D', '335d'));
// console.log(findSourceTokens('style model make', 'make model style'));
// console.log(findSourceTokens('extra style model make', 'make model extra style'));
// console.log(findSourceTokens("Mercedes-Benz", "mercedez benz s63"));


function tokenMatchMerge(source, target) {
    var logger = makeLogger(false);

    // How can we find some common subset between source and target tokens. 
    // This subset should not rely on token order. 

    logger.log("source = ", source, ", target = ", target);
    var {matchWords: sourceTokens} = findSourceTokens(source, target);
    logger.log("sourceTokens = ", sourceTokens);
    var {matchWords: targetTokens} = findSourceTokens(target, source);
    logger.log("targetTokens = ", targetTokens);
    var {matchWords: mergedTokens} = findSourceTokens(sourceTokens.join(" "), targetTokens.join(" "));
    logger.log("mergedTokens = ", mergedTokens);
    var res = findSourceTokens(source, mergedTokens.join(" "), false);
    logger.log("res = ", res);
    logger.log();
    return {matchWords: res.matchIndexes, weight: (res.matchWords.join(" ").length * 2 / (source.length + target.length))};
}


// tokenMatchMerge('7 Series 750Li Sedan 4D', '750lisedan');
// tokenMatchMerge('3 Series 335d Sedan 4D', '335d');

// console.log(tokenMatchMerge('extra style model make', 'make model extra style'));
// console.log(tokenMatchMerge("mercedez benz s63", "Mercedes-Benz"));
// console.log(tokenMatchMerge("2014 Honda Accord 21k miles - 1 Owner - Clean Title - Back-up Camera - Well Kept Sedan", "Honda Accord"));

module.exports = {tokenMatchMerge, findSourceTokens};