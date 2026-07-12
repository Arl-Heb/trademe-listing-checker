// listing fields come straight from req.body, so treat them as untrusted input.
// anything that isn't actually a string gets treated as blank rather than crashing
// the rule on a bad .toLowerCase() call.
function toText(value) {
  return typeof value === 'string' ? value : '';
}

// same idea as toText but for numbers. Number('') is 0 in JS, which would make a
// blank field look like a real zero, so blank/missing values need to bail out first.
function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

// phrases sellers use to technically disclose a knockoff while still catching your eye
// with branded-looking photos and titles. "generic" in the title is the classic version
// of this, it's a single word that gets a seller off the hook for a misleading listing.
const HEDGE_PHRASES = [
  'generic',
  'replica',
  'unbranded',
  'no branding',
  'compatible with',
  'compatible for',
  'inspired by',
  'in the style of',
  'style of',
  'similar to',
];

function findHedgePhrases(text) {
  const lower = toText(text).toLowerCase();
  return HEDGE_PHRASES.filter((phrase) => lower.includes(phrase));
}

function checkHedgeLanguage(listing) {
  const titleHits = findHedgePhrases(listing.title);
  const descriptionHits = findHedgePhrases(listing.description);

  if (titleHits.length === 0 && descriptionHits.length === 0) return null;

  // a hedge word sitting in the title is the bigger tell, since that's what the seller
  // is relying on to say the listing was "disclosed" if a buyer complains later
  const severity = titleHits.length > 0 ? 'high' : 'medium';
  const foundIn = titleHits.length > 0 ? titleHits : descriptionHits;
  const location = titleHits.length > 0 ? 'title' : 'description';

  return {
    id: 'hedge-language',
    severity,
    message: `${location} contains hedging language ("${foundIn.join('", "')}") that can disclaim branding without actually saying the item isn't the real product`,
  };
}

// phrases that describe how an item gets to the buyer without saying anything about
// its actual condition or whether it's sitting in NZ ready to go. on their own these
// are normal, they're a red flag when they show up with nothing else to back them
const SOURCING_PHRASES = [
  'overseas warehouse',
  'international warehouse',
  'direct import',
  'direct from factory',
  'ships from overseas',
  'shipped from overseas',
  'shipped internationally',
  'dropship',
  'drop ship',
];

const CONDITION_WORDS = [
  'brand new',
  'new in box',
  'like new',
  'used',
  'second hand',
  'pre-owned',
  'refurbished',
  'condition',
];

const LOCAL_STOCK_WORDS = [
  'nz stock',
  'new zealand stock',
  'local stock',
  'ships from nz',
  'ready to ship',
  'in stock now',
];

function checkVagueSourcing(listing) {
  const combined = `${toText(listing.title)} ${toText(listing.description)}`.toLowerCase();
  const sourcingHits = SOURCING_PHRASES.filter((phrase) => combined.includes(phrase));

  if (sourcingHits.length === 0) return null;

  const mentionsCondition = CONDITION_WORDS.some((word) => combined.includes(word));
  const mentionsLocalStock = LOCAL_STOCK_WORDS.some((word) => combined.includes(word));

  const missing = [];
  if (!mentionsCondition) missing.push('condition');
  if (!mentionsLocalStock) missing.push('local stock');

  // sourcing language on its own is only worth a medium flag, it's the combination
  // with nothing said about condition or where the item actually is that makes it worse
  const severity = missing.length === 2 ? 'high' : 'medium';
  const missingNote = missing.length > 0 ? `, with no mention of ${missing.join(' or ')}` : '';

  return {
    id: 'vague-sourcing',
    severity,
    message: `listing uses vague sourcing language ("${sourcingHits.join('", "')}")${missingNote}`,
  };
}

// thresholds are rough judgement calls, not anything Trade Me publishes.
// a $300 item is expensive enough that a buyer should expect a track record behind it,
// and 60 days covers the window where an account could've been spun up just for one sale
const HIGH_VALUE_THRESHOLD = 300;
const LOW_REVIEW_COUNT = 10;
const RECENT_ACCOUNT_DAYS = 60;

function checkSellerFeedback(listing) {
  const feedback = listing.sellerFeedback;
  if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) return null;

  const price = toNumber(listing.price);
  const reviewCount = toNumber(feedback.reviewCount);
  const flags = [];

  if (price !== null && price >= HIGH_VALUE_THRESHOLD && reviewCount !== null && reviewCount < LOW_REVIEW_COUNT) {
    flags.push(`only ${reviewCount} review${reviewCount === 1 ? '' : 's'} on a $${price} item`);
  }

  const memberSinceRaw = feedback.memberSince;
  if (typeof memberSinceRaw === 'string' || typeof memberSinceRaw === 'number') {
    const joinedDate = new Date(memberSinceRaw);
    if (!Number.isNaN(joinedDate.getTime())) {
      const daysSinceJoining = (Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceJoining >= 0 && daysSinceJoining < RECENT_ACCOUNT_DAYS) {
        const days = Math.floor(daysSinceJoining);
        flags.push(`seller account is only ${days} day${days === 1 ? '' : 's'} old`);
      }
    }
  }

  if (flags.length === 0) return null;

  return {
    id: 'seller-feedback',
    severity: flags.length > 1 ? 'high' : 'medium',
    message: `seller feedback looks thin for this listing: ${flags.join('; ')}`,
  };
}

const rules = [checkHedgeLanguage, checkVagueSourcing, checkSellerFeedback];

function runChecks(listing) {
  return rules
    .map((rule) => rule(listing))
    .filter((result) => result !== null);
}

module.exports = { runChecks };
