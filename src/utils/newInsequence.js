

function newInsequence(a, b) {
    
    var resMax = {count: 0, match: "", start: 0, end: 0, weight: 0};
    // Try to use a single space between words
    a = a.toLowerCase().replace(/\s/g, ' ');
    a = a.toLowerCase().replace(/(\w)-(\w)/g, '$1 $2');
    b = b.toLowerCase().replace(/\s/g, ' ');
    b = b.toLowerCase().replace(/(\w)-(\w)/g, '$1 $2');
    // Create empty edit distance matrix for all possible modifications of
    // substrings of a to substrings of b.
    const distanceMatrix = Array(b.length + 1).fill({count: 0, match: "", start: 0, end: 0, weight: 0})
        .map(() => Array(a.length + 1).fill({count: 0, match: "", start: 0, end: 0, weight: 0}));
  
    for (let j = 1; j <= b.length; j += 1) {
      for (let i = 1; i <= a.length; i += 1) {
        const isMatch = a[i - 1] === b[j - 1];

        let deletion = Object.assign({}, distanceMatrix[j][i - 1]); // deletion
        if (deletion.count > 0) {
          deletion.end = deletion.end + 1;
          deletion.weight = (deletion.count * 2) / (b.length + (deletion.end - deletion.start) + 1);
        }

        let insertion = Object.assign({}, distanceMatrix[j - 1][i]); // insertion
        if (insertion.count > 0) {
          insertion.end = insertion.end + 1;
          insertion.weight = (insertion.count * 2) / (b.length + (insertion.end - insertion.start) + 1);
        }

        let substitution = distanceMatrix[j - 1][i - 1]; // substitution
        substitution = {...substitution};
        var end = substitution.end;
        var count = substitution.count;
        var match = substitution.match;
        var start = substitution.start;
        var weight = substitution.weight;
        if (isMatch) {
          if (substitution.count === 0) {
            start = j-1;
          }
          end = j-1;
          count += 1;
          match = substitution.match + a[i-1];
          weight = (count * 2) / (b.length + (end - start) + 1);
        }
        substitution = {count, match, start, end, weight};

        var arr = [deletion,insertion,substitution].sort((a, b) => {
          return b.weight - a.weight; //|| (a.end - a.start) - (b.end - b.start);
        });

        if (arr[0].weight > resMax.weight) {
          resMax = arr[0];
        }
        
        distanceMatrix[j][i] = arr[0];
      }
    }
    console.log(distanceMatrix);
  
    return resMax;
  }

// console.log(newInsequence("infiniti", "Chevy Prism (For Parts) sedan"));
console.log(newInsequence("ii", "i"));
  
  
module.exports = {newInsequence};
  