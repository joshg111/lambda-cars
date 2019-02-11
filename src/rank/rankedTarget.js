


class RankedTarget {

  constructor(target) {
    this.target = target;
    this.target["match"] = [];
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

      if (!this.getTarget()["match"]) {
          this.getTarget()["match"] = [];
      }

      for (const m of match) {
          this.getTarget()["match"].push(m);
      }
  }

}


module.exports = {RankedTarget};
