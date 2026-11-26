// Run: npm test (node:test + Node's built-in type stripping; no extra deps).
// Made-up product data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { axisName, lineLabel, sizePickerHeading, variantPickerHeading } from './variants.ts';
import type { ProductVariant } from './types.ts';

function row(over: Partial<ProductVariant>): ProductVariant {
  return {
    index: 0,
    label: '',
    color: null,
    size: null,
    weight: null,
    price: null,
    compare_at_price: null,
    stock: null,
    in_stock: true,
    is_default: false,
    image_url: null,
    ...over,
  };
}

const chocolate = row({ label: 'flavor: chocolate · Size: S, M, L', color: 'chocolate', size: 'S, M, L' });
const heavy = row({ label: 'Color: Red · Size: M, L · Weight: 2kg', color: 'Red', size: 'M, L', weight: '2kg' });
const sizeOnly = row({ label: 'Size: M, L', size: 'M, L' });

// ── lineLabel without labels: byte-identical to the old hardcoded output ──

test('lineLabel: no size chosen returns the row label as sent', () => {
  assert.equal(lineLabel(chocolate, null), 'flavor: chocolate · Size: S, M, L');
  assert.equal(lineLabel(chocolate, null, { color: 'Flavor' }), 'flavor: chocolate · Size: S, M, L');
});

test('lineLabel: no labels keeps Color / Size / Weight', () => {
  assert.equal(lineLabel(chocolate, 'M'), 'Color: chocolate · Size: M');
  assert.equal(lineLabel(heavy, 'L'), 'Color: Red · Size: L · Weight: 2kg');
  assert.equal(lineLabel(sizeOnly, 'M'), 'Size: M');
  assert.equal(lineLabel(heavy, 'L', null), 'Color: Red · Size: L · Weight: 2kg');
  assert.equal(lineLabel(heavy, 'L', undefined), 'Color: Red · Size: L · Weight: 2kg');
});

// ── lineLabel with labels: mirrors Product::variantLabel() ──

test('lineLabel: uses the shop names, casing as typed', () => {
  const labels = { color: 'flavor', size: 'Size', weight: 'Weight' };
  assert.equal(lineLabel(chocolate, 'M', labels), 'flavor: chocolate · Size: M');
  assert.equal(
    lineLabel(heavy, 'L', { color: 'Shade', size: 'fit', weight: 'Net wt' }),
    'Shade: Red · fit: L · Net wt: 2kg',
  );
});

test('lineLabel: server-default labels give the same text as no labels', () => {
  const defaults = { color: 'Color', size: 'Size', weight: 'Weight' };
  for (const v of [chocolate, heavy, sizeOnly]) {
    assert.equal(lineLabel(v, 'M', defaults), lineLabel(v, 'M'));
  }
});

test('lineLabel: a blank / missing / non-string label falls back for that axis only', () => {
  assert.equal(lineLabel(heavy, 'L', { color: '', size: 'fit' }), 'Color: Red · fit: L · Weight: 2kg');
  assert.equal(lineLabel(heavy, 'L', { color: '   ', size: 'fit' }), 'Color: Red · fit: L · Weight: 2kg');
  assert.equal(lineLabel(heavy, 'L', { size: 'fit' }), 'Color: Red · fit: L · Weight: 2kg');
  assert.equal(lineLabel(heavy, 'L', { color: 7, weight: null }), 'Color: Red · Size: L · Weight: 2kg');
  assert.equal(lineLabel(heavy, 'L', {}), 'Color: Red · Size: L · Weight: 2kg');
});

test('lineLabel: label is trimmed like the server (trim), value is not', () => {
  assert.equal(lineLabel(chocolate, 'M', { color: '  flavor ' }), 'flavor: chocolate · Size: M');
  // PHP trim() leaves a no-break space alone, so the server keeps it too.
  assert.equal(lineLabel(chocolate, 'M', { color: '\u00A0flavor\t' }), '\u00A0flavor: chocolate · Size: M');
});

test('lineLabel: axes PHP empty() would skip are skipped, in color/size/weight order', () => {
  const labels = { color: 'flavor' };
  assert.equal(lineLabel(row({ color: '', weight: '1kg', size: 'S, M' }), 'S', labels), 'Size: S · Weight: 1kg');
  assert.equal(lineLabel(row({ color: '0', size: 'S, M' }), 'S', labels), 'Size: S');
  assert.equal(lineLabel(row({ color: 'mint', size: '0, 1' }), '0', labels), 'flavor: mint');
});

// ── picker headings ──

test('variantPickerHeading: renamed colour axis', () => {
  assert.equal(variantPickerHeading([chocolate, heavy], { color: 'Flavor' }), 'Choose Flavor');
  assert.equal(variantPickerHeading([chocolate], { color: 'flavor', size: 'Size', weight: 'Weight' }), 'Choose flavor');
  assert.equal(variantPickerHeading([chocolate], { color: 'স্বাদ' }), 'Choose স্বাদ');
});

test('variantPickerHeading: missing / null / blank / default falls back to "Choose colour"', () => {
  for (const labels of [undefined, null, {}, { color: '' }, { color: '  ' }, { color: 'Color', size: 'Size', weight: 'Weight' }]) {
    assert.equal(variantPickerHeading([chocolate, heavy], labels), 'Choose colour');
  }
});

test('variantPickerHeading: rows without a colour stay "Choose option"', () => {
  assert.equal(variantPickerHeading([chocolate, sizeOnly], { color: 'Flavor' }), 'Choose option');
  assert.equal(variantPickerHeading([sizeOnly], null), 'Choose option');
});

test('sizePickerHeading: renamed size axis, else "Choose size"', () => {
  assert.equal(sizePickerHeading({ size: 'Pack size' }), 'Choose Pack size');
  assert.equal(sizePickerHeading({ color: 'Flavor', size: '' }), 'Choose size');
  for (const labels of [undefined, null, {}, { size: 'Size' }, { size: ' ' }]) {
    assert.equal(sizePickerHeading(labels), 'Choose size');
  }
});

test('axisName: trims, keeps casing, null when unusable', () => {
  assert.equal(axisName({ color: ' FlaVor ' }, 'color'), 'FlaVor');
  assert.equal(axisName({ color: 'Flavor' }, 'size'), null);
  assert.equal(axisName(null, 'color'), null);
  assert.equal(axisName('flavor', 'color'), null);
});
