


function findLongestTargetPrefix(sourceText, target) {
  sourceText = sourceText.toLowerCase();
  target = target.toLowerCase();
  // console.log("source = ", sourceText, ", target = ", target);
  var maxI = 0;
  var res = {count: 0, sourceWord: ""};
  var sourceSplit = sourceText.split(" ");
  var targetSplit = target.split(" ");
  var t = target;

  for(var source of sourceSplit) {

    // for(var t of targetSplit) {
      // console.log(source.length, t.length, source, t);
      // if (source.length < t.length) {
      //   continue;
      // }

      for(var i = 0; i < source.length && i < t.length; i++) {
        var ae = source[i];
        var be = t[i];

        if(ae != be) {
          break;
        }
      }
      // console.log("source = ", source);
      if (i > res.count || (i == res.count && source.length < res.sourceWord.length)) {
        // console.log("Setting with source = ", source);
        res = {count: i, sourceWord: source};
      }
    // }


  }

  console.log("findLongestPrefix = ", res);
  return res;
}

findLongestTargetPrefix('Mercedes-Benz ML 350; Great Condition!', 'M-Class')
findLongestTargetPrefix("asdf aszf faszz", "aszz");
findLongestTargetPrefix("asdf", "jk;l");
findLongestTargetPrefix("c250", "C 250 Coupe 2D")
findLongestTargetPrefix("c250", "C 250 Sport Sedan 4D")


module.exports = {findLongestTargetPrefix};
