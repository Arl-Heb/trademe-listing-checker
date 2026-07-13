const patterns = require('../rules/patterns');
const secondOpinion = require('./secondOpinion');

// this is the one place that decides how risky a listing looks. it's kept out of
// the route handler on purpose, so the actual logic isn't tangled up with Express
// and stays reusable if anything other than the web route ever needs it, a CLI,
// a batch script, a test.
async function checkListing(listing) {
  const triggered = patterns.runChecks(listing);

  // a high severity hit from the free rules is already a confident result, no
  // point asking for a second opinion on it. anything less than that is where
  // the rules are guessing, which is exactly the case the fallback is there for
  const hasHighSeverity = triggered.some((result) => result.severity === 'high');
  const opinion = hasHighSeverity ? null : await secondOpinion.getSecondOpinion(listing);

  return {
    riskLevel: patterns.computeRiskLevel(triggered, opinion?.concernLevel),
    triggered,
    secondOpinion: opinion,
  };
}

module.exports = { checkListing };
