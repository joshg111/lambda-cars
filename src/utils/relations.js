

var RELATIONS = {
  'chevrolet': ['chevy']
}

function getRelations(s) {
  s = s.toLowerCase();
  return (s in RELATIONS) ? RELATIONS[s] : []
}


module.exports = {getRelations}
