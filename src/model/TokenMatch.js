class TokenMatch {
    constructor(words=[], indexes=[], weight=0) {
        this.words = words;
        this.indexes = indexes;
        this.weight = weight;
    }

    merge(otherTokenMatch) {
        this.indexes = this.indexes.concat(otherTokenMatch.indexes);
        this.indexes.sort();
        this.words = this.words.concat(otherTokenMatch.words);
    }
    
    toString() {
        return "words = " + this.words.toString() + ", indexes = " + this.indexes.toString() + 
                ", weight = " + this.weight.toString();
    }
}

module.exports = {TokenMatch};
