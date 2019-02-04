/**
 * Calculates the Damerau-Levenshtein distance between two strings.
 */
function distance(source, target) {
    // console.log("Levenshtein: target = ", source);
    if (!source) return target ? target.length : 0;
    else if (!target) return source.length;

    var m = source.length, n = target.length, INF = m+n, score = new Array(m+2), sd = {};
    for (var i = 0; i < m+2; i++) score[i] = new Array(n+2);
    score[0][0] = INF;
    for (var i = 0; i <= m; i++) {
        score[i+1][1] = i;
        score[i+1][0] = INF;
        sd[source[i]] = 0;
    }
    for (var j = 0; j <= n; j++) {
        score[1][j+1] = j;
        score[0][j+1] = INF;
        sd[target[j]] = 0;
    }

    for (var i = 1; i <= m; i++) {
        var DB = 0;
        for (var j = 1; j <= n; j++) {
            var i1 = sd[target[j-1]],
                j1 = DB;
            if (source[i-1] === target[j-1]) {
                score[i+1][j+1] = score[i][j];
                DB = j;
            }
            else {
                score[i+1][j+1] = Math.min(score[i][j], Math.min(score[i+1][j], score[i][j+1])) + 1;
            }
            score[i+1][j+1] = Math.min(score[i+1][j+1], score[i1] ? score[i1][j1] + (i-i1-1) + 1 + (j-j1-1) : Infinity);
        }
        sd[source[i-1]] = i;
    }
    var res = score[m+1][n+1];
    // console.log("Levenshtein: res = ", res);
    return res
}

// distance('Pathfinder', 'Nissan Armada');
// console.log(distance("2012 ml350 sport utility 4matic suv white", "ML 350 4MATIC Sport Utility 4D"));
// console.log(distance("2012 ml350 sport utility 4matic suv white", "GLK 350 4MATIC Sport Utility 4D"));

module.exports = {damerauLevenshteinDistance: distance};
