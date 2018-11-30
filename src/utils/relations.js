

var RELATIONS = {
  'chevrolet': ['chevy']
}

function getRelations(s) {
  s = s.toLowerCase();
  var res = (s in RELATIONS) ? RELATIONS[s] : []
  hyphen = s.search(/-/g);
  if (hyphen > -1) {
    res.push(s.replace(/-/g, ''))
  }
  
  return res;
}


module.exports = {getRelations}
