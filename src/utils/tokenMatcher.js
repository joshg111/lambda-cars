var {makeLogger} = require('./logger');
var {newInsequence} = require('./newInsequence');
var {TokenMatch} = require('../model/TokenMatch');

function toShortStr(s) {
    return s.toLowerCase().replace(/\s|-/g, ' ');
}

function getTokens(s) {
    // Instead of replacing hyphen with empty string, we could use a space, but if we do that then we wont be able to remove the 
    // matched word/s with the indexes we return.
    return s.toLowerCase().trim().replace(/-/gi, '').split(/\s+/gi);
}

function findSourceTokens(source, target) {
    let logger = makeLogger(false);
    var sourceTokens = getTokens(source);
    var shortTarget = toShortStr(target);
    logger.log(sourceTokens, shortTarget);
    var res = _findSourceTokens(sourceTokens, shortTarget, 0);
    res.words.reverse();
    res.indexes.reverse();
    return res;
}

const SRC_TOKEN_MATCH_THRESHOLD = .87;
let logger = makeLogger(false);
function _findSourceTokens(sourceTokens, shortTarget, iSource) {
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
        var resA = _findSourceTokens(sourceTokens, newShortTarget, iSource + 1);
    }

    var resB = _findSourceTokens(sourceTokens, shortTarget, iSource + 1);

    var averageWeight = resA && ((subWeight + resA.weight) / (resA.weight > 0 ? 2 : 1));
    if (resA) {
        logger.log("\nresA = ", resA, ", resB = ", resB, ", subWeight = ", subWeight, "subMatch = ", subMatch.match, ", average weight = ", averageWeight);
    }
    
    if (resA && averageWeight >= resB.weight) {
        res = resA;
        res.words.push(currToken);
        res.indexes.push(iSource);
        // Not sure if we want to do this, but I just don't want to favor more word matches if it brings down the average word weight.
        res.weight = averageWeight;
    } else {
        res = resB;
    }

    return res;
}

// console.log(findSourceTokens('X3 35i', 'X3 XDrive35i Sport Utility 4D'));
// console.log(findSourceTokens('3 Series 335is', '335is Convertible convertible'));
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