var {lcs} = require('./lcs');




// Input
// source: String - Eg. craigsStyle or posting contents/title.
// targets: [{text: String, ...}] - Eg. KbbStyles or KbbBodyTypes [{text: 'Sedan'}, {text: 'Coupe'}]
// ignoreChars: [Chars] = Eg. ['-'];
function searchRank(source, targets, ignoreChars) {
  if(!source) {
    return null
  }

  var res = [];

  // Remove the ignoreChars
  ignoreChars.forEach((c) => {
    var re = new RegExp(c, 'g');
    source = source.replace(re, '');
    targets.map((t) => {
      t.text = t.text.replace(re, '');
      return t;
    });
  })

  for(var target of targets) {
    var newRankedObj = {'rank': 0, 'value': target};
    res.push(newRankedObj);

    var targetSplit = target.text.split(" ");

    for(var targetWord of targetSplit) {
      if(targetWord.length > 6) {
        if(lcs(targetWord, source) > 2) {
          console.log("Using lcs, found match source = ", source, ", targetWord = ", targetWord);
          newRankedObj.rank++;
        }

      }
      else if((source.match(new RegExp("([^\\w-]|^)" + targetWord + "([^\\w-]|$)", "gi"))) !== null) {
        console.log("Found match source = ", source, ", targetWord = ", targetWord);
        newRankedObj.rank++;
      }
    }
  }
  return res;
}

// searchRank("ABC", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);
// searchRank("asdf asdf ABC asdf", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);
// searchRank("asdf asdf asdfABC asdf", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);
// searchRank("asdf asdf abc", [{'text': "abc", 'href': 'habc1'}, {'text': "ghi", 'href': 'hghi'}, {'text': "abc", 'href': 'habc2'}]);

// Return all the highest ranked items.
function filterByRank(items) {
  var currMax = 0;
  for(var item of items) {
    currMax = Math.max(currMax, item.rank)
  }
  var filtered = items.filter((item) => item.rank === currMax).map((item) => item.value);
  var numFiltered = items.length - filtered.length;

  return {numFiltered, filtered};
}



module.exports = {searchRank, filterByRank};
