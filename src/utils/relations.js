

var RELATIONS = {
  'chevrolet': ['chevy'],
  // A hack to choose solara over camry in the case of 'camry solara'
  'solara': ['solara solara']
};

var REPLACERS = {
  "cabriolet": "convertible"
};

function getRelations(s) {
  s = s.toLowerCase();
  var res = (s in RELATIONS) ? RELATIONS[s] : [];
  for (let r in REPLACERS) {
    let replaced = s.replace(new RegExp(r, "gi"), REPLACERS[r])
    if (replaced != s) {
        res.push(replaced);
    }
  }

  // hyphen = s.search(/-/g);
  // if (hyphen > -1) {
    // First smush the hyphenated word.
    // res.push(s.replace(/-/g, ''))
    // Second, split the hyphentated word.
    // res.push(s.replace(/-/g, ' '))
    // res.push(s.replace(/-\w*/g, ''))
  // }

  return res;
}


module.exports = {getRelations}
