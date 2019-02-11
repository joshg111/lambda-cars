var {lcs} = require('./lcs');
var {levenshteinDistance} = require('./levenshtein');
var {damerauLevenshteinDistance} = require('./damerau-levenshtein');
var {tokenizeInsequenceCount, insequenceCount, srcTokenize, triWayTokenMerge} = require('./insequence-count');
var {findLongestTargetPrefix} = require('./longestPrefix');
var {RankedTarget} = require('../rank/rankedTarget');
var {getRelations} = require('./relations');
var Fuse = require('fuse.js');



var STRATEGIES =
{

  insequenceCount:
  {
    searchStrategy: (source, targetText, rankedTarget) => {
      var threshold = .1;
      var a = triWayTokenMerge(source, targetText);
      rankedTarget.addMatched(a.matchWords);
      a = a.weight;
      // Add it back in when i can run in parallel.
      // var b = tokenizeInsequenceCount(source, targetText);
      // if (b.sources.length > 0) {
      //     rankedTarget.addMatched(...b.sources);
      // }

      // b = b.weight;
      // let res = (a > threshold ? a : 0) + (b > threshold ? b : 0);
      let res = (a > threshold ? a : 0);
      return res;
      // return res + insequenceCount(source, targetText);
    }
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
            avgDiff -= minRes.dist / (targetWord.length + minRes.sourceWord.length - minRes.dist)
          }
          minDist = 100;
        }

        avgDiff = avgDiff / targetSplit.length;
        return (res + avgDiff) / 2;
        // return rankedTarget.getRank() + damerauLevenshteinDistance(targetWord, source);
      }
    }
};

function searchRank(sources, targets, strategies, keys=['text']) {

    // console.log("searchRank called");

    var rankedTargets = [];
    for(var target of targets) {
        rankedTargets.push(new RankedTarget(target));
    }

    for(let source of sources) {
        // console.log("searchRank source = ", source);
        for(var strategy of strategies) {

            if(!source || source === "") {
                continue;
            }

            for(var rankedTarget of rankedTargets) {

                var resRank = rankedTarget.getRank();
                var targetText = "";
                // var countKeys = 0;
                for (var key of keys) {
                    if (targetText && !targetText.endsWith(" ")) {
                        targetText += " ";
                    }
                    targetText += key in rankedTarget.getTarget() ? rankedTarget.getTarget()[key]: "";
                }
                if (!targetText) {
                  continue;
                }

                var rank1 = STRATEGIES[strategy].searchStrategy(source, targetText, rankedTarget);
                if(getRelations(targetText)) {
                    for(var relation of getRelations(targetText)) {
                        var rank2 = STRATEGIES[strategy].searchStrategy(source, relation, rankedTarget);
                        rank1 = Math.max(rank1, rank2);
                    }
                }

                // if (rank1 > 0) {
                //     countKeys += 1;
                // }
                // rankedTarget.setRank(rank1);
                resRank += rank1;

                // No longer use key length to average the rank since we do this anyway for all targets regardless.
                // Also, there's an issue when using multiple sources, averaging the rank for each source will
                // unnecessarily decrease the rank when a given source does not help a given target, but for
                // ranks that are 0, no penalty is incurred, therefore dividing buy key length is not good.
                // We could divide by key length after all sources have been processed, but this is not necessary.
                // rankedTarget.setRank(resRank === 0 ? 0 : (resRank / keys.length));
                rankedTarget.setRank(resRank <= 0 ? 0 : (resRank));
                console.log("source = ", source, ", weight = ", rankedTarget.getRank(), ", targetText = ", rankedTarget.getTarget());
            }
            // console.log("strategy = ", strategy, ", rankedTargets =", rankedTargets);
        }
    }

    let filterStrategy = STRATEGIES[strategy].filterStrategy ? STRATEGIES[strategy].filterStrategy : Math.max;
    return filterByRank(rankedTargets, filterStrategy);
}

// searchRank("ABC", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);

function filterByRank(items, strategy = Math.max) {
  // console.log("filterByRank called");
  var curr = items[0].getRank();
  for(var item of items) {
    curr = strategy(curr, item.getRank());
  }
  var filtered = items.filter((item) => item.getRank() === curr).map((item) => item.getTarget());

  console.log("filtered = ", filtered);
  return filtered;
}

function fuseSearch(sources, targets) {
    let options = {
        shouldSort: true,
        includeMatches: true,
        tokenize: true,
        includeScore: true,
        maxPatternLength: 320,
        minMatchCharLength: 1,
        keys: [
            {name: "target.model"},
            {name: "target.styleText"}
        ]
    };
    let i = 0;
    let targetMapById = {};
    let rankedTargets = targets.map((t) => {
      return new RankedTarget(t);
    });
    for (let t of rankedTargets) {
        t["id"] = i;
        targetMapById[i] = t;
        i++;
    }

    let fuse = new Fuse(rankedTargets, options);
    for (let source of sources) {
        if (!source) {
          continue;
        }
        let fuseResults = fuse.search(source);
        updateTargetWithFuseResults(targetMapById, fuseResults);
    }

    return filterByRank(rankedTargets, Math.max);
}

// console.log(fuseSearch(["a", undefined], [{model: "a", styleText: "b"}, {model: "c", styleText: "d"}]));

function updateTargetWithFuseResults(targetMapById, fuseResults) {
    for (let fuseResult of fuseResults) {
        let t = targetMapById[fuseResult.item.id];
        // Invert the score, so we can maximize on rank instead of minimize.
        t.incrementRank(1 - fuseResult.score);
        t.getTarget()["isStyleMatch"] = isStyleMatch(t, fuseResult);
    }
}

function isStyleMatch(target, fuseResult) {
    return true;
}

module.exports = {searchRank, filterByRank, fuseSearch};
