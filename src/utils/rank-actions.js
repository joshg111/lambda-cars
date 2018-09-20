var {lcs} = require('./lcs');
var {levenshteinDistance} = require('./levenshtein');
var {damerauLevenshteinDistance} = require('./damerau-levenshtein');
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
  findLongestPrefix:
    {
      searchStrategy: (source, targetWord, rankedTarget) => {
        return rankedTarget.getRank() - findLongestTargetPrefix(source, targetWord);
      }
    },

  word:
    {
      searchStrategy: (source, targetText, rankedTarget) => {
        var res = rankedTarget.getRank();
        var targetSplit = targetText.split(" ");
        for(var targetWord of targetSplit) {
          if((source.match(new RegExp("([^\\w-]|^)" + targetWord + "([^\\w-]|$)", "gi"))) !== null) {
            console.log("Found match source = ", source, ", targetWord = ", targetWord);
            res -= targetWord.length;
          }
        }
        return res;
      }
    },
  damerauLevenshteinDistance:
    {
      searchStrategy: (source, targetWord, rankedTarget) => {
        return rankedTarget.getRank() + damerauLevenshteinDistance(targetWord, source);
      }
    }
};

function searchRank(sources, targets, strategies) {

  console.log("searchRank called");

  var rankedTargets = []
  for(var target of targets) {
    rankedTargets.push(new RankedTarget(target));
  }

  for(let source of sources) {
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
            rank1 = Math.min(rank1, rank2);
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

function filterByRank(items, strategy = Math.min) {
  console.log("filterByRank called");
  var curr = items[0].getRank();
  for(var item of items) {
    curr = strategy(curr, item.getRank());
  }
  var filtered = items.filter((item) => item.getRank() === curr).map((item) => item.getTarget());

  console.log(filtered);
  return filtered;
}


module.exports = {searchRank, filterByRank};
