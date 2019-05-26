var {lcs} = require('./lcs');
var {levenshteinDistance} = require('./levenshtein');
var {damerauLevenshteinDistance} = require('./damerau-levenshtein');
var {tokenizeInsequenceCount, insequenceCount, srcTokenize, triWayTokenMerge} = require('./insequence-count');
var {findLongestTargetPrefix} = require('./longestPrefix');
var {RankedTarget} = require('../rank/rankedTarget');
var {getRelations} = require('./relations');
var Fuse = require('fuse.js');
var {Match} = require('../rank/match');
var {Source} = require('../rank/source');



var STRATEGIES =
{

  insequenceCount:
  {
    searchStrategy: (source, targetText, rankedTarget) => {
      // var threshold = .05;
      var a = triWayTokenMerge(source.data, targetText);
      var match = new Match(source, a.matchWords);
      // console.log("Adding match = ", match, ", target = ", targetText, ", weight = ", a.weight);
      if (match.matches.length > 0) {
          // console.log("Adding match = ", match);
          rankedTarget.addMatched(match);

      }

      a = a.weight;
      // Add it back in when i can run in parallel.
      // var b = tokenizeInsequenceCount(source, targetText);
      // if (b.sources.length > 0) {
      //     rankedTarget.addMatched(...b.sources);
      // }

      // b = b.weight;
      // let res = (a > threshold ? a : 0) + (b > threshold ? b : 0);
      // let res = (a > threshold ? a : 0);
      return a;
      // return res + insequenceCount(source, targetText);
    }
  },

  findLongestPrefix:
    {
      searchStrategy: (source, targetWord, rankedTarget) => {
        prefixRes = findLongestTargetPrefix(source.data, targetWord);

        if (prefixRes.count > 0 && prefixRes.sourceWord.length > 0) {
          var res = (prefixRes.count / (prefixRes.sourceWord.length));
          return (rankedTarget.getRank() + res);
        }
        return 0;
      }
    },

  word:
    {
      searchStrategy: (source, targetText, rankedTarget) => {
        var res = 0;
        var targetSplit = targetText.split(" ");
        for(var targetWord of targetSplit) {
          if((source.data.match(new RegExp("([^\\w-]|^)" + targetWord + "([^\\w-]|$)", "gi"))) !== null) {
            res += 1;
          }
        }

        if (res > 0) {
          return (res + rankedTarget.getRank()) / 2;
        }

        return 0;
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


// TESTING
// let res = searchRank(
//   [new Source('Make Mercedes-Benz Model Bi Turbo S63 AMG coupe'), new Source('mercedez benz s63')],
//   [{"make":"Mercedes-Benz","href":"https://www.kbb.com/honda/accord/2014/lx-sedan-4d/?vehicleid=392668&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Accord","styleText":"Sport Sedan 4D","href":"https://www.kbb.com/honda/accord/2014/sport-sedan-4d/?vehicleid=392669&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Accord","styleText":"EX Sedan 4D","href":"https://www.kbb.com/honda/accord/2014/ex-sedan-4d/?vehicleid=392670&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Accord","styleText":"EX-L Sedan 4D","href":"https://www.kbb.com/honda/accord/2014/ex-l-sedan-4d/?vehicleid=392674&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Accord","styleText":"Plug-in Hybrid Sedan 4D","href":"https://www.kbb.com/honda/accord/2014/plug-in-hybrid-sedan-4d/?vehicleid=385279&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Accord","styleText":"Touring Sedan 4D","href":"https://www.kbb.com/honda/accord/2014/touring-sedan-4d/?vehicleid=392673&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Accord","styleText":"LX-S Coupe 2D","href":"https://www.kbb.com/honda/accord/2014/lx-s-coupe-2d/?vehicleid=392671&intent=buy-used&category=coupe&modalview=false&pricetype=private-party&condition=good"},{"model":"Accord","styleText":"EX Coupe 2D","href":"https://www.kbb.com/honda/accord/2014/ex-coupe-2d/?vehicleid=392672&intent=buy-used&category=coupe&modalview=false&pricetype=private-party&condition=good"},{"model":"Accord","styleText":"EX-L Coupe 2D","href":"https://www.kbb.com/honda/accord/2014/ex-l-coupe-2d/?vehicleid=392675&intent=buy-used&category=coupe&modalview=false&pricetype=private-party&condition=good"},{"model":"Accord Hybrid","styleText":"Sedan 4D","href":"https://www.kbb.com/honda/accord-hybrid/2014/sedan-4d/?vehicleid=393649&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Accord Hybrid","styleText":"EX-L Sedan 4D","href":"https://www.kbb.com/honda/accord-hybrid/2014/ex-l-sedan-4d/?vehicleid=393648&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Accord Hybrid","styleText":"Touring Sedan 4D","href":"https://www.kbb.com/honda/accord-hybrid/2014/touring-sedan-4d/?vehicleid=393647&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Civic","styleText":"Natural Gas Sedan 4D","href":"https://www.kbb.com/honda/civic/2014/natural-gas-sedan-4d/?vehicleid=396010&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Civic","styleText":"HF Sedan 4D","href":"https://www.kbb.com/honda/civic/2014/hf-sedan-4d/?vehicleid=393970&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Civic","styleText":"LX Sedan 4D","href":"https://www.kbb.com/honda/civic/2014/lx-sedan-4d/?vehicleid=393969&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Civic","styleText":"Hybrid Sedan 4D","href":"https://www.kbb.com/honda/civic/2014/hybrid-sedan-4d/?vehicleid=396011&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Civic","styleText":"EX Sedan 4D","href":"https://www.kbb.com/honda/civic/2014/ex-sedan-4d/?vehicleid=393972&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Civic","styleText":"EX-L Sedan 4D","href":"https://www.kbb.com/honda/civic/2014/ex-l-sedan-4d/?vehicleid=393971&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Civic","styleText":"Si Sedan 4D","href":"https://www.kbb.com/honda/civic/2014/si-sedan-4d/?vehicleid=396009&intent=buy-used&category=sedan&modalview=false&pricetype=private-party&condition=good"},{"model":"Civic","styleText":"LX Coupe 2D","href":"https://www.kbb.com/honda/civic/2014/lx-coupe-2d/?vehicleid=393973&intent=buy-used&category=coupe&modalview=false&pricetype=private-party&condition=good"},{"model":"Civic","styleText":"EX Coupe 2D","href":"https://www.kbb.com/honda/civic/2014/ex-coupe-2d/?vehicleid=393974&intent=buy-used&category=coupe&modalview=false&pricetype=private-party&condition=good"},{"model":"Civic","styleText":"EX-L Coupe 2D","href":"https://www.kbb.com/honda/civic/2014/ex-l-coupe-2d/?vehicleid=393975&intent=buy-used&category=coupe&modalview=false&pricetype=private-party&condition=good"},{"model":"Civic","styleText":"Si Coupe 2D","href":"https://www.kbb.com/honda/civic/2014/si-coupe-2d/?vehicleid=396012&intent=buy-used&category=coupe&modalview=false&pricetype=private-party&condition=good"},{"model":"Crosstour","styleText":"EX Sport Utility 4D","href":"https://www.kbb.com/honda/crosstour/2014/ex-sport-utility-4d/?vehicleid=392940&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Crosstour","styleText":"EX-L Sport Utility 4D","href":"https://www.kbb.com/honda/crosstour/2014/ex-l-sport-utility-4d/?vehicleid=392941&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"CR-V","styleText":"LX Sport Utility 4D","href":"https://www.kbb.com/honda/cr-v/2014/lx-sport-utility-4d/?vehicleid=392341&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"CR-V","styleText":"EX Sport Utility 4D","href":"https://www.kbb.com/honda/cr-v/2014/ex-sport-utility-4d/?vehicleid=392340&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"CR-V","styleText":"EX-L Sport Utility 4D","href":"https://www.kbb.com/honda/cr-v/2014/ex-l-sport-utility-4d/?vehicleid=392342&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"CR-Z","styleText":"Coupe 2D","href":"https://www.kbb.com/honda/cr-z/2014/coupe-2d/?vehicleid=393143&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"CR-Z","styleText":"EX Coupe 2D","href":"https://www.kbb.com/honda/cr-z/2014/ex-coupe-2d/?vehicleid=393144&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Insight","styleText":"LX Hatchback 4D","href":"https://www.kbb.com/honda/insight/2014/lx-hatchback-4d/?vehicleid=393909&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Insight","styleText":"Hatchback 4D","href":"https://www.kbb.com/honda/insight/2014/hatchback-4d/?vehicleid=393908&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Insight","styleText":"EX Hatchback 4D","href":"https://www.kbb.com/honda/insight/2014/ex-hatchback-4d/?vehicleid=393910&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Odyssey","styleText":"LX Minivan 4D","href":"https://www.kbb.com/honda/odyssey/2014/lx-minivan-4d/?vehicleid=391424&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Odyssey","styleText":"EX Minivan 4D","href":"https://www.kbb.com/honda/odyssey/2014/ex-minivan-4d/?vehicleid=391423&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Odyssey","styleText":"EX-L Minivan 4D","href":"https://www.kbb.com/honda/odyssey/2014/ex-l-minivan-4d/?vehicleid=391431&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Odyssey","styleText":"Touring Minivan 4D","href":"https://www.kbb.com/honda/odyssey/2014/touring-minivan-4d/?vehicleid=391428&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Odyssey","styleText":"Touring Elite Minivan 4D","href":"https://www.kbb.com/honda/odyssey/2014/touring-elite-minivan-4d/?vehicleid=391425&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Pilot","styleText":"LX Sport Utility 4D","href":"https://www.kbb.com/honda/pilot/2014/lx-sport-utility-4d/?vehicleid=392859&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Pilot","styleText":"EX Sport Utility 4D","href":"https://www.kbb.com/honda/pilot/2014/ex-sport-utility-4d/?vehicleid=392854&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Pilot","styleText":"EX-L Sport Utility 4D","href":"https://www.kbb.com/honda/pilot/2014/ex-l-sport-utility-4d/?vehicleid=392856&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Pilot","styleText":"Touring Sport Utility 4D","href":"https://www.kbb.com/honda/pilot/2014/touring-sport-utility-4d/?vehicleid=392860&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Ridgeline","styleText":"RT Pickup 4D 5 ft","href":"https://www.kbb.com/honda/ridgeline/2014/rt-pickup-4d-5-ft/?vehicleid=392773&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Ridgeline","styleText":"Sport Pickup 4D 5 ft","href":"https://www.kbb.com/honda/ridgeline/2014/sport-pickup-4d-5-ft/?vehicleid=392776&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Ridgeline","styleText":"RTS Pickup 4D 5 ft","href":"https://www.kbb.com/honda/ridgeline/2014/rts-pickup-4d-5-ft/?vehicleid=392774&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Ridgeline","styleText":"RTL Pickup 4D 5 ft","href":"https://www.kbb.com/honda/ridgeline/2014/rtl-pickup-4d-5-ft/?vehicleid=392780&intent=buy-used&modalview=false&pricetype=private-party&condition=good"},{"model":"Ridgeline","styleText":"SE Pickup 4D 5 ft","href":"https://www.kbb.com/honda/ridgeline/2014/se-pickup-4d-5-ft/?vehicleid=392775&intent=buy-used&modalview=false&pricetype=private-party&condition=good"}]
// ,
//   ["insequenceCount"],
//   ["make"]);
// console.log(res);

function searchRank(sources, targets, strategies, keys=['text']) {

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
                // ranks that are 0, no penalty is incurred, therefore dividing by key length is not good.
                // We could divide by key length after all sources have been processed, but this is not necessary.
                // rankedTarget.setRank(resRank === 0 ? 0 : (resRank / keys.length));
                rankedTarget.setRank(resRank <= 0 ? 0 : (resRank));
                // console.log("source = ", source, ", weight = ", rankedTarget.getRank(), ", targetText = ", rankedTarget.getTarget().match.toString());
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

  // console.log("filtered = ", filtered);
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
