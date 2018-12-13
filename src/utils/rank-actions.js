var {lcs} = require('./lcs');
var {levenshteinDistance} = require('./levenshtein');
var {damerauLevenshteinDistance} = require('./damerau-levenshtein');
var {insequenceCount} = require('./insequence-count')
var {findLongestTargetPrefix} = require('./longestPrefix');
var {RankedTarget} = require('../rank/rankedTarget')
var {getRelations} = require('./relations');




// Input
// source: String - Eg. craigsStyle or posting contents/title.
// targets: [{text: String, ...}] - Eg. KbbStyles or KbbBodyTypes [{text: 'Sedan'}, {text: 'Coupe'}]
// ignoreChars: [Chars] = Eg. ['-'];
// function searchRank(source, targets, ignoreChars=[], matchStrategy = ["word"]) {
//
//   console.log("searchRank called");
//
//   if(!source) {
//     return null
//   }
//
//   var res = [];
//
//   // Remove the ignoreChars
//   ignoreChars.forEach((c) => {
//     var re = new RegExp(c, 'g');
//     source = source.replace(re, '');
//     targets.map((t) => {
//       if(!t.matchText) {
//         t.matchText = t.text.replace(re, '');
//       }
//       return t;
//     });
//   })
//
//   for(var target of targets) {
//     var newRankedObj = {'rank': 0, 'value': target};
//     res.push(newRankedObj);
//
//
//     var targetSplit = target.matchText.split(" ");
//
//
//     for(var targetWord of targetSplit) {
//       if(matchStrategy.includes("word")) {
//         if((source.match(new RegExp("([^\\w-]|^)" + targetWord + "([^\\w-]|$)", "gi"))) !== null) {
//           console.log("Found match source = ", source, ", targetWord = ", targetWord);
//           newRankedObj.rank++;
//         }
//       }
//
//       if(matchStrategy.includes("lcs")) {
//         var maxLen = lcs(targetWord, source);
//         if(maxLen > 2) {
//           console.log("Using lcs, found match source = ", source, ", targetWord = ", targetWord);
//           newRankedObj.rank += maxLen;
//         }
//       }
//
//       if(matchStrategy.includes("prefix")) {
//
//       }
//
//     }
//   }
//   return res;
// }


var STRATEGIES =
{

  insequenceCount:
  {
    searchStrategy: (source, targetText, rankedTarget) => {
      var res = rankedTarget.getRank();
      return res + insequenceCount(source, targetText);
    }
    // searchStrategy: (source, targetText, rankedTarget) => {
    //   // console.log("inseq targetText = ", targetText);
    //   // console.log("inseq rankedTarget = ", rankedTarget);
    //   source = source.toLowerCase();
    //   targetText = targetText.toLowerCase();
    //
    //   var res = rankedTarget.getRank();
    //   var targetSplit = targetText.trim().split(" ");
    //   var sourceSplit = source.trim().split(" ");
    //   var maxSource = "";
    //   var maxTarget = "";
    //   var maxCount = 0;
    //   // var maxCount = 0;
    //   // var maxRes = {count: 0, sourceWord: ""};
    //   var weightedCount = 0
    //
    //   // Just match the whole source and target, that way it represents
    //   // all of the target in the right sequence.
    //   // var weightedCount = insequenceCount(targetText, source) / source.length;
    //
    //   for(var targetWord of targetSplit) {
    //     if (!targetWord) {
    //       continue;
    //     }
    //     for(var sourceWord of sourceSplit) {
    //       if (!sourceWord) {
    //         continue
    //       }
    //       // Target should be a subset of source.
    //       // if (sourceWord.length >= targetWord.length) {
    //         // maxCount = Math.max(insequenceCount(targetWord, sourceWord), maxCount)
    //         var count = insequenceCount(targetWord, sourceWord);
    //         var tempMax = (count / sourceWord.length);
    //         if (tempMax > weightedCount) {
    //           maxSource = sourceWord;
    //           maxTarget = targetWord;
    //           maxCount = count;
    //
    //         }
    //         weightedCount = Math.max(tempMax, weightedCount);
    //       // }
    //     }
    //     // res is the sum of the max insequence count averaged by the source
    //     // and target lengths.
    //     // var tempMax = (maxRes.count / (maxRes.sourceWord.length))
    //     // if (tempMax > weightedCount) {
    //     //   // console.log("sourceWord > ", maxRes.sourceWord, targetWord, tempMax);
    //     //   weightedCount = Math.max(weightedCount, tempMax);
    //     // }
    //
    //
    //     // res += (maxRes.count / (maxRes.sourceWord.length + targetWord.length - maxRes.count));
    //     // res += (maxRes.count / (source.length + targetWord.length - maxRes.count));
    //     // maxCount = 0;
    //     // maxRes = {count: 0, sourceWord: ""};
    //   }
    //
    //   // Return the average of each target word rank.
    //   // Don't return the average here, cuz it penalizes multi word matches.
    //   // return (res / (targetSplit.length + 1));
    //   if (weightedCount > 0) {
    //     console.log("maxSource = ", maxSource, ", maxTarget = ", maxTarget, "maxCount = ", maxCount, "max weight = ", weightedCount);
    //     // Arbitraily divide by 2, to decrease the weight of this algorithm.
    //     return (res + weightedCount)
    //   }
    //
    //   return res;
    //
    //   // return rankedTarget.getRank() - insequenceCount(source, targetText);
    // }
  },

  findLongestPrefix:
    {
      searchStrategy: (source, targetWord, rankedTarget) => {
        prefixRes = findLongestTargetPrefix(source, targetWord);

        if (prefixRes.count > 0 && prefixRes.sourceWord.length > 0) {
          var res = (prefixRes.count / (prefixRes.sourceWord.length));
          return (rankedTarget.getRank() + res);
        }
        return rankedTarget.getRank();
      }
    },

  word:
    {
      searchStrategy: (source, targetText, rankedTarget) => {
        // var res = rankedTarget.getRank();
        var res = 0;
        var targetSplit = targetText.split(" ");
        for(var targetWord of targetSplit) {
          if((source.match(new RegExp("([^\\w-]|^)" + targetWord + "([^\\w-]|$)", "gi"))) !== null) {
            console.log("Found match source = ", source, ", targetWord = ", targetWord);
            res += 1;
          }
          // else {
          //   res -= 1;
          // }
        }

        // res = res / source.length;
        if (res > 0) {
          return (res + rankedTarget.getRank()) / 2;
        }

        return rankedTarget.getRank()
      }
    },
  damerauLevenshteinDistance:
    {
      searchStrategy: (source, targetText, rankedTarget) => {
        // We should run this for each target word, and each source word, and
        // add the smallest distance overall.
        console.log("targetText = ", targetText);

        var res = rankedTarget.getRank();
        return res;
        var targetSplit = targetText.split(" ");
        var sourceSplit = source.split(" ");
        var minRes = {dist: 100, sourceWord: ""};
        var avgDiff = 0;

        for(var targetWord of targetSplit) {
          for(var sourceWord of sourceSplit) {
            var dist = damerauLevenshteinDistance(targetWord, sourceWord)
            if (dist < minRes.dist ||
              dist == minRes.dist && sourceWord.length < minRes.sourceWord.length) {
                minRes = {dist, sourceWord}
              }
          }
          if (minRes.dist < 100) {
            console.log("levenshtein = ", avgDiff)
            avgDiff -= minRes.dist / (targetWord.length + minRes.sourceWord.length - minRes.dist)
          }
          minDist = 100;
        }

        console.log("levenshtein = ", avgDiff)
        console.log("avgDiff = ", avgDiff / targetSplit.length)
        avgDiff = avgDiff / targetSplit.length;
        console.log("res = ", res + avgDiff)
        return (res + avgDiff) / 2;
        // return rankedTarget.getRank() + damerauLevenshteinDistance(targetWord, source);
      }
    }
};

// var r1 = new RankedTarget("EXL Coupe 2D")
// var r2 = new RankedTarget("EXL Sedan 2D")
// console.log(STRATEGIES.findLongestPrefix.searchStrategy("RemoteStarter 2012 Honda Accord EX-L Bluetooth", r1.getTarget(), r1))
// console.log(STRATEGIES.insequenceCount.searchStrategy("RemoteStarter 2012 Honda Accord EX-L Bluetooth", r2.getTarget(), r2))

function searchRank(sources, targets, strategies) {

  console.log("searchRank called");

  var rankedTargets = []
  for(var target of targets) {
    rankedTargets.push(new RankedTarget(target));
  }

  for(let source of sources) {
    console.log("searchRank source = ", source);
    for(let strategy of strategies) {

      if(!source || source === "") {
        continue;
      }

      for(var rankedTarget of rankedTargets) {

        // var targetSplit = rankedTarget.getTarget().text.split(" ");
        var targetText = rankedTarget.getTarget().text;

        var rank1 = STRATEGIES[strategy].searchStrategy(source, targetText, rankedTarget);
        if(getRelations(targetText)) {
          for(var relation of getRelations(targetText)) {
            var rank2 = STRATEGIES[strategy].searchStrategy(source, relation, rankedTarget);
            console.log("Found relation rank = ", rank2, "relation = ", relation, "strategy = ", strategy);
            console.log("Normal rank = ", rank1);
            rank1 = Math.max(rank1, rank2);
          }
        }
        rankedTarget.setRank(rank1);
      }
      console.log("strategy = ", strategy, ", rankedTargets =", rankedTargets);
    }
  }

  console.log("rankedTargets =", rankedTargets);
  return filterByRank(rankedTargets);
}



// searchRank("ABC", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);
// searchRank("asdf asdf ABC asdf", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);
// searchRank("asdf asdf asdfABC asdf", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);
// searchRank("asdf asdf abc", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);

// Return all the highest ranked items.
// function filterByRank(items) {
//   console.log("filterByRank called");
//   var currMax = 0;
//   for(var item of items) {
//     currMax = Math.max(currMax, item.rank)
//   }
//   var filtered = items.filter((item) => item.rank === currMax).map((item) => item.value);
//   var numFiltered = items.length - filtered.length;
//
//   console.log("filtered = ", filtered);
//   return {numFiltered, filtered};
// }

function filterByRank(items, strategy = Math.max) {
  console.log("filterByRank called");
  var curr = items[0].getRank();
  for(var item of items) {
    curr = strategy(curr, item.getRank());
  }
  var filtered = items.filter((item) => item.getRank() === curr).map((item) => item.getTarget());

  console.log("filtered = ", filtered);
  return filtered;
}


module.exports = {searchRank, filterByRank};
