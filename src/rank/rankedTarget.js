


class RankedTarget {

  constructor(target) {
    this.target = target;
    this.rank = 0;
  }

  getTarget() {
    return this.target;
  }

  getRank() {
    return this.rank;
  }

  setRank(rank) {
    this.rank = rank;
  }

  incrementRank(rank) {
    this.rank += rank;
  }

  decrementRank(rank) {
    this.rank -= rank;
  }

  addMatched(match) {
      this.getTarget()["match"] ? this.getTarget()["match"].push(match) : this.getTarget()["match"] = [match];
  }

}


module.exports = {RankedTarget};
