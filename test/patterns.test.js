// pattern rules are plain functions with no network calls or side effects, so
// they're the cheapest and highest value thing in this app to have tests for.
// run with `npm test`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const patterns = require('../rules/patterns');

test('hedge language in the title is flagged as high severity', () => {
  const triggered = patterns.runChecks({ title: 'Generic', description: 'a plain description' });
  const hit = triggered.find((result) => result.id === 'hedge-language');
  assert.ok(hit, 'expected hedge-language to be triggered');
  assert.equal(hit.severity, 'high');
});

test('hedge language only in the description is medium severity', () => {
  const triggered = patterns.runChecks({
    title: 'Nike shoes',
    description: 'these are inspired by a well known brand',
  });
  const hit = triggered.find((result) => result.id === 'hedge-language');
  assert.ok(hit, 'expected hedge-language to be triggered');
  assert.equal(hit.severity, 'medium');
});

test('a clean listing does not trigger hedge language', () => {
  const triggered = patterns.runChecks({
    title: 'Nike Air Max 90',
    description: 'Selling my Nike shoes, worn a few times.',
  });
  assert.equal(triggered.find((result) => result.id === 'hedge-language'), undefined);
});

test('vague sourcing with nothing else said is high severity', () => {
  const triggered = patterns.runChecks({
    title: 'Watch',
    description: 'Ships from overseas warehouse, direct import.',
  });
  const hit = triggered.find((result) => result.id === 'vague-sourcing');
  assert.ok(hit, 'expected vague-sourcing to be triggered');
  assert.equal(hit.severity, 'high');
});

test('vague sourcing softens to medium once condition and stock are mentioned', () => {
  const triggered = patterns.runChecks({
    title: 'Watch',
    description: 'Direct import, brand new in box, NZ stock ready to ship.',
  });
  const hit = triggered.find((result) => result.id === 'vague-sourcing');
  assert.ok(hit, 'expected vague-sourcing to be triggered');
  assert.equal(hit.severity, 'medium');
});

test('seller feedback flags a high value item with a thin history and a new account', () => {
  const triggered = patterns.runChecks({
    title: 'MacBook Pro',
    description: 'Selling my laptop',
    price: 2400,
    sellerFeedback: { reviewCount: 2, memberSince: new Date().toISOString() },
  });
  const hit = triggered.find((result) => result.id === 'seller-feedback');
  assert.ok(hit, 'expected seller-feedback to be triggered');
  assert.equal(hit.severity, 'high');
});

test('seller feedback does not flag an established seller', () => {
  const triggered = patterns.runChecks({
    title: 'MacBook Pro',
    description: 'Selling my laptop',
    price: 2400,
    sellerFeedback: { reviewCount: 340, memberSince: '2015-03-01' },
  });
  assert.equal(triggered.find((result) => result.id === 'seller-feedback'), undefined);
});

test('malformed seller feedback fields do not throw', () => {
  assert.doesNotThrow(() => {
    patterns.runChecks({
      title: 'Item',
      description: 'desc',
      price: 'not a number',
      sellerFeedback: { reviewCount: 'none', memberSince: { nested: 'object' } },
    });
  });
});

test('templated description flags leftover placeholder brackets as high severity', () => {
  const triggered = patterns.runChecks({ title: 'Watch', description: 'Buy this [Product Name] today.' });
  const hit = triggered.find((result) => result.id === 'templated-description');
  assert.ok(hit, 'expected templated-description to be triggered');
  assert.equal(hit.severity, 'high');
});

test('templated description flags boilerplate stuffing as medium severity', () => {
  const triggered = patterns.runChecks({
    title: 'Watch',
    description:
      '100% authentic, high quality material, satisfaction guaranteed, fast shipping, best price guaranteed.',
  });
  const hit = triggered.find((result) => result.id === 'templated-description');
  assert.ok(hit, 'expected templated-description to be triggered');
  assert.equal(hit.severity, 'medium');
});

test('a specific, well written description triggers nothing', () => {
  const triggered = patterns.runChecks({
    title: 'Seiko 5 automatic watch',
    description:
      'Seiko 5 SNK809, 37mm case, automatic movement, bought in 2022, small scratch on the bezel, comes with box and papers.',
  });
  assert.deepEqual(triggered, []);
});

test('a non-object body does not crash any rule', () => {
  assert.doesNotThrow(() => {
    patterns.runChecks({ title: 12345, description: ['not', 'a', 'string'] });
  });
});

test('computeRiskLevel takes the highest severity across rules and haiku', () => {
  assert.equal(patterns.computeRiskLevel([], undefined), 'low');
  assert.equal(patterns.computeRiskLevel([{ severity: 'medium' }], undefined), 'medium');
  assert.equal(patterns.computeRiskLevel([{ severity: 'medium' }], 'high'), 'high');
  assert.equal(patterns.computeRiskLevel([], 'medium'), 'medium');
  assert.equal(patterns.computeRiskLevel([], 'low'), 'low');
});
