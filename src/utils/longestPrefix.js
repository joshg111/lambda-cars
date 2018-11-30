


function findLongestTargetPrefix(sourceText, target) {
  sourceText = sourceText.toLowerCase();
  target = target.toLowerCase();
  // console.log("source = ", sourceText, ", target = ", target);
  var maxI = 0;
  var res = {count: 0, sourceWord: ""};
  var sourceSplit = sourceText.split(" ");

  for(var source of sourceSplit) {
    for(var i = 0; i < source.length && i < target.length; i++) {
      var ae = source[i];
      var be = target[i];
      // console.log(ae, be);
      if(ae != be) {
        // console.log("maxI = ", maxI);
        break;
      }
    }
    if (i > res.count || (i == res.count && source.length > res.sourceWord.length)) {
      res = {count: i, sourceWord: source};
    }

  }

  // console.log("findLongestPrefix = ", res);
  return res;
}

findLongestTargetPrefix('mercedes benz gl 450', 'gl-class')
findLongestTargetPrefix("asdf aszf faszz", "aszz");
findLongestTargetPrefix("asdf", "jk;l");


module.exports = {findLongestTargetPrefix};
