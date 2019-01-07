

var RELATIONS = {
  'chevrolet': ['chevy'],
  // A hack to choose solara over camry in the case of 'camry solara'
  'solara': ['solara solara']
}

function getRelations(s) {
  s = s.toLowerCase();
  var res = (s in RELATIONS) ? RELATIONS[s] : []
  hyphen = s.search(/-/g);
  if (hyphen > -1) {
    // First smush the hyphenated word.
    res.push(s.replace(/-/g, ''))
    // Second, split the hyphentated word.
    // res.push(s.replace(/-/g, ' '))
    res.push(s.replace(/-\w*/g, ''))
  }

  return res;
}


module.exports = {getRelations}
