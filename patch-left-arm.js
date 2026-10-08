#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
function patch(file, replacements) {
  let s = fs.readFileSync(file, 'utf8');
  let n = 0;
  for (const [from, to] of replacements) {
    if (s.includes(from)) { s = s.split(from).join(to); n++; console.log('  OK'); }
    else console.log('  MISS:', from.slice(0, 50));
  }
  fs.writeFileSync(file, s);
  return n;
}
const hands = 'src/weapons/hands.js';
const vm = 'src/weapons/viewmodel.js';
console.log('Patching hands.js ...');
patch(hands, [
  ['const L_UPPER = 0.33;', 'const L_UPPER = 0.40;'],
  ['const L_FORE = 0.3;', 'const L_FORE = 0.36;'],
  ['this.pole = new THREE.Vector3(side * 0.46, -0.86, 0.22).normalize();',
   'this.pole = new THREE.Vector3(side * 0.55, -0.90, 0.05).normalize();'],
  ['const maxD = (this.l1 + this.l2) * 0.995;',
   'const maxD = (this.l1 + this.l2) * 0.88;'],
  ['this.upper = buildSleeve(materials.sleeve, this.l1, 0.044 * this.scale, 0.036 * this.scale,',
   'this.upper = buildSleeve(materials.sleeve, this.l1, 0.032 * this.scale, 0.026 * this.scale,'],
  ['this.fore = buildSleeve(materials.sleeve, this.l2, 0.034 * this.scale, 0.024 * this.scale,',
   'this.fore = buildSleeve(materials.sleeve, this.l2, 0.024 * this.scale, 0.018 * this.scale,'],
]);
console.log('Patching viewmodel.js ...');
patch(vm, [
  [`this.armL = new Arm(-1, handMats, {
      scale: 0.97,
      shoulderX: 0.2,
      shoulderY: -0.22,
      shoulderZ: 0.02,
      pose: 'clamp',
    });`,
   `this.armL = new Arm(-1, handMats, {
      scale: 0.95,
      upper: 0.42,
      fore: 0.38,
      shoulderX: 0.16,
      shoulderY: -0.30,
      shoulderZ: 0.06,
      pole: [0.55, -0.90, 0.05],
      pose: 'clamp',
    });`],
  ['this.shoulderL = new THREE.Vector3(-0.2, -0.22, 0.02);',
   'this.shoulderL = new THREE.Vector3(-0.16, -0.30, 0.06);'],
]);
console.log('Done. Restart vite / hard-refresh.');
