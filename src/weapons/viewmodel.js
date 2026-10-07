import * as THREE from 'three';
import { Arm, HAND_POSES } from './hands.js';
import { buildClips, makeSampleResult } from './clips.js';
import { triCount, mergeAll } from './geometry.js';
import {
  Spring, Spring3, Noise1, clamp, clamp01, lerp, damp, smootherstep, wrapPi, TAU,
} from './mathx.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'XYZ');
const _m = new THREE.Matrix4();

function shapeMasks(geo, o) {
  const col = geo.getAttribute('color');
  if (!col) return geo;
  const a = col.array;
  const amp = [o.wearAmp ?? 1, o.grimeAmp ?? 1, o.aoAmp ?? 1];
  const exp = [o.wearExp ?? 1, o.grimeExp ?? 1, o.aoExp ?? 1];
  for (let i = 0; i < a.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = a[i + k];
      a[i + k] = Math.pow(Math.max(0, Math.min(1, v)), exp[k]) * amp[k];
    }
  }
  col.needsUpdate = true;
  return geo;
}

function handBasis(out, finger, back) {
  _v.set(-finger[0], -finger[1], -finger[2]).normalize();
  _v2.set(back[0], back[1], back[2]);
  _v2.addScaledVector(_v, -_v2.dot(_v));
  if (_v2.lengthSq() < 1e-8) _v2.set(0, 1, 0).addScaledVector(_v, -_v.y);
  _v2.normalize();
  _v3.crossVectors(_v2, _v).normalize();
  _m.makeBasis(_v3, _v2, _v);
  return out.setFromRotationMatrix(_m);
}

function applyNode(obj, node) {
  obj.position.fromArray(node.pos);
  if (node.rot) obj.rotation.fromArray(node.rot);
}

export class Viewmodel {
  constructor(ctx, mats) {
    this.ctx = ctx;
    this.mats = mats;
    this.rng = ctx.rng.fork();

    this.anchor = new THREE.Object3D();
    this.anchor.name = 'ow-viewmodel-anchor';
    this.rig = new THREE.Object3D();
    this.rig.name = 'ow-viewmodel-rig';
    this.anchor.add(this.rig);
    ctx.viewScene.add(this.anchor);

    const handMats = {
      glove: mats.get('glove'),
      pad: mats.get('glove_pad'),
      seam: mats.get('glove_seam'),
      sleeve: mats.get('sleeve'),
    };

    this.armR = new Arm(1, handMats, {
      scale: 1,
      shoulderX: 0.205,
      shoulderY: -0.2,
      shoulderZ: 0.06,
      pose: 'grip',
    });
    // Natural support arm: longer bones, lower/inboard shoulder, elbow hangs down-outboard
    this.armL = new Arm(-1, handMats, {
      scale: 1,
      upper: 0.40,
      fore: 0.36,
      shoulderX: 0.18,
      shoulderY: -0.28,
      shoulderZ: 0.04,
      pole: [-0.50, -0.94, 0.05],
      pose: 'clamp',
    });
    this.rig.add(this.armR.root);
    this.rig.add(this.armL.root);

    const bakeArms = this.mats.lib?.bakeMasks?.bind(this.mats.lib) ?? null;
    if (bakeArms) {
      this.armR.bakeSurfaceMasks(bakeArms, shapeMasks, this.rng);
      this.armL.bakeSurfaceMasks(bakeArms, shapeMasks, this.rng);
    }

    this.shoulderR = new THREE.Vector3(0.205, -0.2, 0.06);
    this.shoulderL = new THREE.Vector3(-0.18, -0.28, 0.04);

    this.reticle = new THREE.Object3D();
    this.reticle.name = 'ow-reticle';
    this.anchor.add(this.reticle);

    this.weapons = new Map();
    this.active = null;
    this.activeId = null;
    this.triggerT = 0;
    this.boltHold = 0;
    this.adsT = 0;
    this.drawT = 1;
    this.clip = null;
    this.clipName = null;
    this.clipT = 0;
    this.onClipEvent = null;

    this._handPos = new THREE.Vector3();
    this._handQuat = new THREE.Quaternion();
    this._handPosL = new THREE.Vector3();
    this._handQuatL = new THREE.Quaternion();
    this.clipResult = makeSampleResult();
    this.sway = new Spring3(18, 0.85);
    this.bob = new Spring3(14, 0.9);
    this.lag = new Spring3(12, 0.75);
    this.recoilPos = new Spring3(28, 0.55);
    this.recoilRot = new Spring3(32, 0.5);
    this.noise = [];
    for (let i = 0; i < 6; i++) this.noise.push(new Noise1(this.rng, 512));

    this._muzzle = new THREE.Vector3();
    this._eject = new THREE.Vector3();
    this._bore = new THREE.Vector3(0, 0, -1);
  }

  addWeapon(model, def) {
    const group = new THREE.Object3D();
    group.name = 'weapon-' + def.id;
    group.visible = false;
    this.rig.add(group);

    const meshes = [];
    const parts = {};
    const bake = this.mats.lib?.bakeMasks?.bind(this.mats.lib) ?? null;

    const build = (asm, parent) => {
      if (!asm) return;
      const map = asm.byMaterial || null;
      if (map) {
        const entries = map instanceof Map ? map.entries() : Object.entries(map);
        for (const [matKey, geo] of entries) {
          const mat = this.mats.get(matKey) || this.mats.get('polymer');
          if (bake && geo && geo.getAttribute) {
            try {
              bake(geo, { wear: 1, grime: 1, ao: 1, edgeThreshold: 0.16, rng: this.rng });
              shapeMasks(geo, { wearExp: 2.2, grimeExp: 1.6, aoExp: 1.4 });
            } catch (_) {}
          }
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          parent.add(mesh);
          meshes.push(mesh);
        }
      }
      if (asm.root) parent.add(asm.root);
      if (asm.group) parent.add(asm.group);
    };

    if (model.body) build(model.body, group);
    if (model.moving) {
      for (const [name, asm] of Object.entries(model.moving)) {
        const sub = new THREE.Object3D();
        sub.name = name;
        build(asm, sub);
        group.add(sub);
        parts[name] = sub;
      }
    }

    const n = model.nodes || {};
    if (parts.magazine && n.magSeat) applyNode(parts.magazine, n.magSeat);
    if (parts.charging && n.chargeRest) applyNode(parts.charging, n.chargeRest);
    if (parts.bolt && n.boltRest) applyNode(parts.bolt, n.boltRest);
    if (parts.slide && n.slideRest) applyNode(parts.slide, n.slideRest);
    if (parts.trigger && n.triggerPivot) applyNode(parts.trigger, n.triggerPivot);
    if (parts.selector && n.selectorPivot) applyNode(parts.selector, n.selectorPivot);

    let tris = 0;
    try { tris = triCount ? triCount(group) : 0; } catch (_) {}

    const entry = {
      id: def.id,
      def,
      model,
      group,
      meshes,
      parts,
      nodes: n,
      gripR: n.gripR || { pos: [0.02, -0.04, 0.02], finger: [0, -0.35, -0.94], back: [0.95, 0.25, 0.18] },
      gripL: n.gripL || { pos: [-0.09, 0.07, -0.22], finger: [0.82, 0.5, -0.28], back: [-0.5, 0.32, -0.8] },
      lhandPose: def.id === 'pistol' ? 'cup' : 'clamp',
      magLen: 0.12,
      magSeatPos: new THREE.Vector3(),
      magSeatQuat: new THREE.Quaternion(),
      tris,
      clips: buildClips ? buildClips(def.id) : {},
    };
    if (n.magSeat) entry.magSeatPos.fromArray(n.magSeat.pos);

    this.weapons.set(def.id, entry);
    try { this._fitSupportHand(entry); } catch (_) {}
    return entry;
  }

  _fitSupportHand(w) {
    const hg = w.model && w.model.nodes && w.model.nodes.handguard;
    const gL = w.gripL;
    if (!hg || !gL || w.id === 'pistol') return;
    this._handPosL.fromArray(gL.pos);
    handBasis(this._handQuatL, gL.finger || [0.82, 0.5, -0.28], gL.back || [-0.5, 0.32, -0.8]);
    const axis = new THREE.Vector3().fromArray(hg.axis || [0, 0.075, 0]);
    const dir = new THREE.Vector3().fromArray(hg.dir || [0, 0, 1]);
    const contacts = this.armL.fitToCylinder(
      this._handPosL, this._handQuatL, axis, dir, hg.r || 0.027, {}
    );
    this.armL.bakeContactAO(contacts || [], 0.012, 0.7);
  }

  setActive(id) {
    const w = this.weapons.get(id);
    if (!w || w === this.active) return this.active;
    if (this.active) this.active.group.visible = false;
    this.active = w;
    this.activeId = id;
    w.group.visible = true;
    this.armR.setPose('grip');
    this.armL.setPose(w.lhandPose || (id === 'pistol' ? 'cup' : 'clamp'));
    return this.active;
  }

  play(name) {
    const w = this.active;
    if (!w) return 0;
    const clip = w.clips && w.clips[name];
    if (!clip) {
      this.clipName = name;
      this.clipT = 0;
      const dur = name === 'holster' || name === 'draw' ? 0.35 : (name.indexOf('reload') === 0 ? 1.8 : 0.5);
      this.clip = { duration: dur, events: [] };
      if (this.onClipEvent) this.onClipEvent('start', name);
      return dur;
    }
    this.clip = clip;
    this.clipName = name;
    this.clipT = 0;
    if (this.onClipEvent) this.onClipEvent('start', name);
    return clip.duration || 0.5;
  }

  stopClip() {
    if (this.clipName && this.onClipEvent) this.onClipEvent('end', this.clipName);
    this.clip = null;
    this.clipName = null;
    this.clipT = 0;
  }

  addRecoil(pitch, yaw, first) {
    const scale = first ? 1.15 : 1;
    this.recoilPos.kick(this.rng.signed() * 0.002 * scale, 0.004 * scale, 0.012 * scale);
    this.recoilRot.kick(pitch * 0.8 * scale, -yaw * 0.6 * scale, this.rng.signed() * 0.15 * scale);
  }

  jump() {
    this.bob.kick(0, -0.02, 0);
  }

  land(vel) {
    const s = clamp(vel / 8, 0.2, 1.5);
    this.bob.kick(0, -0.03 * s, 0.01 * s);
  }

  update(dt, state) {
    const cam = this.ctx.camera;
    if (cam) {
      this.anchor.position.copy(cam.position);
      this.anchor.quaternion.copy(cam.quaternion);
    }

    const ads = state && state.ads ? (typeof state.ads === 'number' ? state.ads : 1) : 0;
    this.adsT = damp(this.adsT, ads, 12, dt);

    if (this.clip) {
      this.clipT += dt;
      const events = this.clip.events || [];
      for (const ev of events) {
        if (!ev._fired && this.clipT >= (ev.t || 0)) {
          ev._fired = true;
          if (this.onClipEvent) this.onClipEvent(ev.name, this.clipName);
        }
      }
      if (this.clipT >= (this.clip.duration || 0.5)) {
        if (this.onClipEvent) this.onClipEvent('end', this.clipName);
        for (const ev of events) ev._fired = false;
        this.clip = null;
        this.clipName = null;
        this.clipT = 0;
      }
    }

    const adsT = this.adsT;
    this.rig.position.set(
      lerp(0.04, 0.0, adsT),
      lerp(-0.08, -0.04, adsT),
      lerp(-0.28, -0.22, adsT)
    );
    this.rig.rotation.set(lerp(0.02, 0.0, adsT), lerp(0.04, 0.0, adsT), 0);

    this.sway.step(dt);
    this.bob.step(dt);
    this.lag.step(dt);
    this.recoilPos.step(dt);
    this.recoilRot.step(dt);

    this.rig.position.x += this.sway.x * 0.01 + this.recoilPos.x;
    this.rig.position.y += this.sway.y * 0.008 + this.bob.y + this.recoilPos.y;
    this.rig.position.z += this.recoilPos.z;
    this.rig.rotation.x += this.recoilRot.x * 0.15;
    this.rig.rotation.y += this.recoilRot.y * 0.12;
    this.rig.rotation.z += this.recoilRot.z * 0.1;

    const w = this.active;
    if (w) this._solveHands(w, this.clipResult);
  }

  _solveHands(w, res) {
    _q.copy(this.rig.quaternion).invert();
    _v.copy(this.shoulderR).sub(this.rig.position).applyQuaternion(_q);
    this.armR.shoulder.copy(_v);
    _v.copy(this.shoulderL).sub(this.rig.position).applyQuaternion(_q);
    this.armL.shoulder.copy(_v);

    const gR = w.gripR;
    if (gR) {
      this._handPos.fromArray(gR.pos);
      handBasis(this._handQuat, gR.finger || [0, -0.35, -0.94], gR.back || [0.95, 0.25, 0.18]);
      this.armR.solve(this._handPos, this._handQuat);
      this.armR.setTrigger(this.triggerT);
    }

    const gL = w.gripL;
    if (gL) {
      const pos = gL.pos;
      const finger = gL.finger || [0.82, 0.5, -0.28];
      const back = gL.back || [-0.5, 0.32, -0.8];
      const pose = w.lhandPose || (w.id === 'pistol' ? 'cup' : 'clamp');
      this._handPosL.set(pos[0], pos[1], pos[2]);
      handBasis(this._handQuatL, finger, back);
      if (pose !== this.armL.pose) this.armL.setPose(pose);
      this.armL.solve(this._handPosL, this._handQuatL);
    }
  }

  muzzleWorld(out) {
    const w = this.active;
    const o = out || this._muzzle;
    if (!w) return o.set(0, 0, 0);
    const n = w.nodes && w.nodes.muzzle;
    if (n) {
      o.fromArray(n);
      w.group.localToWorld(o);
    } else {
      o.set(0, 0.075, -0.45);
      w.group.localToWorld(o);
    }
    return o;
  }

  ejectWorld(out) {
    const w = this.active;
    const o = out || this._eject;
    if (!w) return o.set(0, 0, 0);
    const n = w.nodes && w.nodes.eject;
    if (n) {
      o.fromArray(n);
      w.group.localToWorld(o);
    } else {
      o.set(0.03, 0.08, -0.05);
      w.group.localToWorld(o);
    }
    return o;
  }

  ejectVelocity(out) {
    const o = out || new THREE.Vector3();
    return o.set(1.5 + this.rng.signed() * 0.3, 1.2, this.rng.signed() * 0.4);
  }

  boreDir(out) {
    const o = out || this._bore;
    const cam = this.ctx.camera;
    if (cam) o.set(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
    return o;
  }

  dispose() {
    this.armR.dispose();
    this.armL.dispose();
    this.anchor.removeFromParent();
  }
}
