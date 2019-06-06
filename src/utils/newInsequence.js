

function newInsequence(a, b) {
    // a = a.toLowerCase().replace(/\s|-/g, '');
    // b = b.toLowerCase().replace(/\s|-/g, '');
    
    // Try to use a single space between words
    a = a.toLowerCase().replace(/\s|-/g, ' ');
    b = b.toLowerCase().replace(/\s|-/g, ' ');
    // Create empty edit distance matrix for all possible modifications of
    // substrings of a to substrings of b.
    const distanceMatrix = Array(b.length + 1).fill({count: 0, match: ""})
        .map(() => Array(a.length + 1).fill({count: 0, match: ""}));
  
    // Fill the first row of the matrix.
    // If this is first row then we're transforming empty string to a.
    // In this case the number of transformations equals to size of a substring.
    // for (let i = 0; i <= a.length; i += 1) {
    //   distanceMatrix[0][i] = i;
    // }
  
    // Fill the first column of the matrix.
    // If this is first column then we're transforming empty string to b.
    // In this case the number of transformations equals to size of b substring.
    // for (let j = 0; j <= b.length; j += 1) {
    //   distanceMatrix[j][0] = j;
    // }
  
    for (let j = 1; j <= b.length; j += 1) {
      for (let i = 1; i <= a.length; i += 1) {
        const isMatch = a[i - 1] === b[j - 1];
        const indicator = isMatch ? 1 : 0;
        const matchChar = isMatch ? a[i-1] : "";
        let deletion = distanceMatrix[j][i - 1]; // deletion
        let insertion = distanceMatrix[j - 1][i]; // insertion
        let substitution = distanceMatrix[j - 1][i - 1]; // substitution
        substitution = {count: substitution.count + indicator, match: substitution.match + matchChar};

        distanceMatrix[j][i] = [deletion,insertion,substitution].sort((a, b) => b.count - a.count)[0];
      }
    }
  
    var res = distanceMatrix[b.length][a.length];
    // console.log(res);
    return res;
  }
  
  
// newInsequence('CLS CLS500 MILITARY 0 DOWN NAVY FED', 'CLS Class CLS 500 Coupe 4D');
//   newInsequence("Mercedes Benz GL 450 awd suv 7 passenger/ BEST OFFER .", "GLClass");
  // levenshteinDistance("Using lcs, found match source =  Mercedes Benz GL 450 awd suv 7 passenger/ BEST OFFER .", "CClass");
  
  
  module.exports = {newInsequence};
  