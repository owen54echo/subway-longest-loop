const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('interaction-polish.js', 'utf8');
function setup({reduced = false, hidden = false} = {}) {
  const frames = [];
  const document = {hidden, addEventListener() {}};
  const window = {matchMedia: () => ({matches: reduced}), requestAnimationFrame: callback => frames.push(callback)};
  vm.runInNewContext(source, {window, document, performance: {now: () => 100}, setTimeout, clearTimeout});
  const element = {dataset: {motionValue: '15587'}, textContent: '15,587', isConnected: true};
  const container = {querySelectorAll: () => [element]};
  return {window, document, element, container, frames};
}
test('counter keeps the final value in the DOM while its visual number moves', () => {
  const {window, element, container, frames} = setup();
  window.InteractionPolish.animateCounts(container);
  assert.equal(element.textContent, '15,587'); assert.equal(element.dataset.countDisplay, '0');
  frames.shift()(350);
  assert.equal(element.textContent, '15,587'); assert.notEqual(element.dataset.countDisplay, '0');
  frames.shift()(700);
  assert.equal(element.textContent, '15,587'); assert.equal(element.dataset.counting, undefined);
});
test('reduced motion and a hidden tab never start a counter animation', () => {
  for (const options of [{reduced:true}, {hidden:true}]) {
    const {window, element, container, frames} = setup(options);
    window.InteractionPolish.animateCounts(container);
    assert.equal(element.textContent, '15,587'); assert.equal(element.dataset.counting, undefined); assert.equal(frames.length, 0);
  }
});
test('counter finishes when the tab is hidden', () => {
  const {window, document, element, container, frames} = setup();
  window.InteractionPolish.animateCounts(container); document.hidden = true; frames.shift()(200);
  assert.equal(element.dataset.counting, undefined); assert.equal(element.textContent, '15,587');
});
