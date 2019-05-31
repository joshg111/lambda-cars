

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

  return res;
}


module.exports = {getRelations}
