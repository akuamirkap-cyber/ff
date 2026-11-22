import * as T from "three";
import { entityGeometry, type Palette } from "./geometry";
import { litMaterial, SHARED } from "./glsl";
import { CREW, pilotStation } from "./referenceCrew";
import {
  buildDiverMesh,
  buildSubmarineMesh,
  buildCockpitMesh,
} from "../penyelam/meshes.js";
import {
  crewPose,
  subLens,
  subLightDirection,
  subYaw,
} from "../crewKinematics";
import type { DiverPose, ReefResidents } from "../residents";

const palette: Record<number, [number, number, number, number, number]> = {
  0: [0.76, 0.51, 0.12, 0.03, 0.04],
  1: [0.66, 0.31, 0.16, 0.045, 0.82],
  2: [0.93, 0.71, 0.36, 0.06, 0.88],
  3: [0.88, 0.65, 0.32, 0.48, 0.1],
  4: [0.08, 0.1, 0.12, 0, 0.18],
  5: [0.26, 0.16, 0.095, 0.01, 0.2],
  6: [0.62, 0.5, 0.22, 0.025, 0.8],
  7: [1, 0.95, 0.73, 1.8, 0.3],
  8: [0.82, 0.33, 0.25, 0.03, 0.2],
  10: [0.26, 0.32, 0.29, 0.035, 0.72],
  11: [0.82, 0.63, 0.29, 0.03, 0.85],
  12: [0.9, 0.58, 0.13, 0.02, 0.3],
  13: [0.12, 0.7, 0.73, 0.1, 0.85],
  14: [0.96, 0.66, 0.27, 0.82, 0.12],
  15: [0.92, 0.74, 0.37, 0.03, 0.9],
  16: [1, 0.92, 0.65, 2.1, 0.1],
  17: [0.15, 0.19, 0.18, 0, 0.65],
  18: [1, 0.5, 0.17, 1.6, 0.1],
  50: [0.84, 0.54, 0.36, 0.22, 0],
  58: [0.84, 0.54, 0.36, 0.22, 0],
  51: [0.15, 0.085, 0.045, 0.04, 0.08],
  53: [0.3, 0.075, 0.058, 0.1, 0],
  55: [0.78, 0.37, 0.29, 0.18, 0],
  56: [0.16, 0.085, 0.05, 0.03, 0],
};
const pal: Palette = (m) => palette[m] || [0.55, 0.54, 0.45, 0, 0.16];
const tempEnd = new T.Vector3(),
  tempStart = new T.Vector3(),
  rot = new T.Euler();

function glassMaterial(cockpit = false) {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uGlass: { value: cockpit ? 1 : 0 }, uTime: SHARED.uTime },
    vertexShader: `varying vec3 vN;varying vec3 vP;varying vec3 vW;void main(){vN=normalize(normalMatrix*normal);vP=position;vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vN;varying vec3 vP;varying vec3 vW;uniform float uGlass,uTime;
      void main(){vec3 n=normalize(vN);float rim=pow(1.-abs(n.z),2.0);
        float broad=pow(max(dot(n,normalize(vec3(-.42,.83,.48))),0.),7.);
        float stripe=pow(max(dot(n,normalize(vec3(.35,.75,.56))),0.),26.);
        float glint=pow(max(dot(n,normalize(vec3(-.46,.72,.69))),0.),66.);
        float dapple=.5+.5*sin(vW.x*.085+sin(vW.y*.10+uTime*.42)*1.7+vW.z*.033);
        vec3 sea=vec3(.17,.54,.64)+vec3(.11,.27,.30)*broad;
        vec3 reflection=vec3(.69,.96,1.)*(.30*broad+.36*stripe)+vec3(1.,.96,.82)*glint*.66;
        vec3 color=sea+reflection+vec3(.05,.14,.17)*dapple;
        float a=mix(.055+.32*rim+.29*glint,.19+.57*rim+.19*broad+.18*stripe+.35*glint,uGlass);
        gl_FragColor=vec4(color,clamp(a,0.,.83));}`,
  });
}

function lightVolume(warm: boolean) {
  const g = new T.CylinderGeometry(1, 1, 1, 24, 1, true);
  const mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    uniforms: {
      uTime: SHARED.uTime,
      uDimensions: { value: new T.Vector3(1, 10, 100) },
      uTint: {
        value: warm
          ? new T.Vector3(1, 0.79, 0.43)
          : new T.Vector3(0.66, 0.89, 1),
      },
      uPower: { value: warm ? 0.37 : 0.34 },
    },
    vertexShader: `uniform vec3 uDimensions;varying float vT;varying vec3 vNormal;varying vec3 vWorld;
    void main(){vT=position.y+.5;float r=mix(uDimensions.x,uDimensions.y,vT);vec3 lp=vec3(position.x*r,position.z*r,-vT*uDimensions.z);
    vec3 n=normalize(vec3(position.x,position.z,(uDimensions.x-uDimensions.y)/uDimensions.z));vNormal=normalize(normalMatrix*n);vec4 wp=modelMatrix*vec4(lp,1.);vWorld=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader: `uniform vec3 uTint;uniform float uPower,uTime;varying float vT;varying vec3 vNormal;varying vec3 vWorld;
    void main(){float soft=pow(abs(normalize(vNormal).z),1.95);float axial=pow(max(0.,1.-vT),1.4)*smoothstep(-.012,.025,vT);
    float water=.88+.12*sin(vWorld.x*.047+vWorld.y*.06+sin(vWorld.z*.032-uTime*.4));gl_FragColor=vec4(uTint,uPower*soft*axial*water);}`,
  });
  mat.forceSinglePass = true;
  const mesh = new T.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 25;
  mesh.name = warm ? "Bow searchlight" : "Helmet light";
  return mesh;
}

type Beam = ReturnType<typeof lightVolume>;
const beamForward = new T.Vector3(0, 0, -1);
function beamTo(
  mesh: Beam,
  origin: T.Vector3,
  vector: T.Vector3,
  length: number,
  r0: number,
  r1: number,
) {
  mesh.position.copy(origin);
  mesh.quaternion.setFromUnitVectors(beamForward, vector);
  mesh.material.uniforms.uDimensions.value.set(r0, r1, length);
  const slot = SHARED.uLampCount.value;
  if (slot < 7) {
    SHARED.uLampOrigin.value[slot].set(origin.x, origin.y, origin.z, length);
    SHARED.uLampAxis.value[slot].set(
      vector.x,
      vector.y,
      vector.z,
      ((mesh.name === "Bow searchlight" ? 1 : -1) * r1) / length,
    );
    SHARED.uLampCount.value++;
  }
}

export function createExpeditionRigs() {
  const disposables = new Set<{ dispose: () => void }>(),
    sea = new T.Group();
  const source = buildDiverMesh(),
    ship = buildSubmarineMesh(),
    instruments = buildCockpitMesh(),
    lit = litMaterial({ fog: 0.055 }),
    litD = litMaterial({ fog: 0.035 });
  const glass = glassMaterial(true), helmetGlass = glassMaterial();
  const subBody = entityGeometry(
    ship,
    (m, p) => p < 5 && p !== 1 && m !== 13,
    pal,
  );
  const subGlass = entityGeometry(ship, (m, p) => m === 13 && p === 0, pal);
  const screw = entityGeometry(ship, (_m, p) => p === 1, pal).translate(
    0,
    0.04,
    -2.2,
  );
  const body = entityGeometry(source, (_m, p) => p === 0 || p === 8, pal);
  const helmet = entityGeometry(source, (_m, p) => p === 10, pal).translate(
    0,
    -0.612,
    0,
  );
  const face = entityGeometry(source, (_m, p) => p === 1, pal).translate(
    0,
    -0.612,
    0,
  );
  const gear = entityGeometry(
    source,
    (_m, p, z) => p === 9 && z >= -0.365,
    pal,
  ).translate(-0.205, -0.335, -0.003);
  const shaft = entityGeometry(
    source,
    (_m, p, z) => p === 9 && z < -0.365,
    pal,
  ).translate(-0.205, -0.335, -0.003);
  const legs = [0, 1].map((k) =>
    entityGeometry(source, (_m, p) => p === 4 + k, pal).translate(
      k ? -0.072 : 0.072,
      -0.295,
      0,
    ),
  );
  const fins = [0, 1].map((k) =>
    entityGeometry(source, (_m, p) => p === 6 + k, pal).translate(
      k ? -0.0756 : 0.0756,
      -0.033,
      0.07,
    ),
  );
  const arms = [0, 1].map((k) =>
    entityGeometry(source, (_m, p) => p === 2 + k, pal).translate(
      k ? -0.155 : 0.155,
      -0.54,
      0,
    ),
  );
  const subGroup = new T.Group(),
    diverGroup = new T.Group(),
    beams = new T.Group();
  sea.add(subGroup, diverGroup, beams);
  const subs = [48, 44].map((scale, i) => {
    const wrap = new T.Group(),
      root = new T.Group();
    root.scale.setScalar(scale);
    wrap.add(root);
    subGroup.add(wrap);
    root.add(new T.Mesh(subBody, lit));
    const prop = new T.Mesh(screw, lit);
    prop.position.set(0, -0.04, 2.2);
    root.add(prop);
    const pane = new T.Mesh(subGlass, glass);
    pane.name = "Clear observation dome";
    pane.renderOrder = 24;
    root.add(pane);
    const helm = pilotStation(ship, source, pal, instruments);
    root.add(helm.station);
    const { pilot, wheel } = helm;
    const lights = [lightVolume(true), lightVolume(true)];
    beams.add(...lights);
    root.rotation.y = i ? subYaw(1, 0, i) : subYaw(-1, 0, i);
    return { wrap, root, prop, pilot, wheel, lights, helm };
  });
  const divers = [38, 36, 36].map((scale, i) => {
    const wrap = new T.Group(),
      root = new T.Group();
    root.scale.setScalar(scale * 0.8);
    wrap.add(root);
    diverGroup.add(wrap);
    const cloth = litMaterial({ fog: 0.035, suit: CREW[i].suit });
    root.name = CREW[i].name;
    root.userData.source = "PENYELAM:buildDiverMesh";
    const head = new T.Group();
    head.name = "Articulated clear helmet";
    head.position.y = 0.612;
    head.add(new T.Mesh(helmet, litD), new T.Mesh(face, litD));
    const visor = new T.Mesh(new T.SphereGeometry(1, 26, 16), helmetGlass);
    visor.position.set(0, 0.162 * 1.47, -0.159 * 1.47);
    visor.scale.set(0.087 * 1.47, 0.087 * 1.47, 0.013 * 1.47);
    visor.renderOrder = 24;
    head.add(visor);
    root.add(new T.Mesh(body, cloth), head);
    const tool = new T.Group();
    const loaded = new T.Mesh(shaft, lit);
    tool.add(new T.Mesh(gear, lit), loaded);
    root.add(tool);
    const leg = [0, 1].map((k) => {
      const articulated = litMaterial({ fog: 0.035, suit: CREW[i].suit });
      articulated.uniforms.uKnee = { value: 0 };
      articulated.vertexShader =
        "uniform float uKnee;\n" +
        articulated.vertexShader.replace(
          "vec4 wp = modelMatrix * vec4(position, 1.);",
          `vec3 local=position;vec3 raised=local-vec3(0.,-.12,0.);float bend=uKnee*smoothstep(.095,.15,-local.y);float co=cos(bend),si=sin(bend);local.yz=mat2(co,si,-si,co)*raised.yz+vec2(-.12,0.);vec4 wp=modelMatrix*vec4(local,1.);`,
        );
      const l = new T.Mesh(legs[k], articulated);
      l.position.set(k ? 0.072 : -0.072, 0.295, 0);
      const f = new T.Mesh(fins[k], litD);
      f.position.set(k ? 0.0036 : -0.0036, -0.262, -0.07);
      l.add(f);
      root.add(l);
      return { l, f };
    });
    const arm = [0, 1].map((k) => {
      const m = new T.Mesh(arms[k], cloth);
      m.position.set(k ? 0.155 : -0.155, 0.54, 0);
      root.add(m);
      return m;
    });
    const palm = new T.Object3D();
    palm.name = "Original rubber mitten grip";
    palm.position.set(0.182 - 0.155, 0.334 - 0.54, -0.03);
    arm[1].add(palm);
    const light = lightVolume(false);
    beams.add(light);
    const bubbleGeo = new T.BufferGeometry();
    bubbleGeo.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(10 * 3), 3).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    const bubbleMat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uPx: SHARED.uPx },
      vertexShader: `uniform float uPx;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(uPx*1.9,1.6,7.);}`,
      fragmentShader: `void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;float rim=smoothstep(.61,.89,r)*(1.-smoothstep(.94,1.,r));float glint=exp(-dot(p-vec2(-.16,-.18),p-vec2(-.16,-.18))*130.);float core=(1.-smoothstep(.0,.48,r))*.10;gl_FragColor=vec4(mix(vec3(.53,.84,.96),vec3(1.),glint),clamp(rim*.68+glint*.70+core,0.,1.));}`,
    });
    const bubbles = new T.Points(bubbleGeo, bubbleMat);
    bubbles.frustumCulled = false;
    bubbles.renderOrder = 27;
    sea.add(bubbles);
    return {
      wrap,
      root,
      head,
      tool,
      loaded,
      leg,
      arm,
      palm,
      light,
      bubbles,
      i,
    };
  });
  function poseDiver(i: number, d: DiverPose) {
    const rig = divers[i],
      p = crewPose(d),
      scale = d.depth * d.presence;
    rig.wrap.position.set(d.x, -d.y, -95 - (1 - d.depth) * 75);
    rig.wrap.scale.setScalar(scale);
    rig.wrap.rotation.z = p.roll;
    rig.root.quaternion.copy(p.body);
    rig.root.position.copy(p.rootOffset);
    rig.head.quaternion.copy(p.head);
    rig.leg[0].l.rotation.x = p.hipL;
    rig.leg[1].l.rotation.x = p.hipR;
    rig.leg[0].f.rotation.x = p.finL;
    rig.leg[1].f.rotation.x = p.finR;
    for (let k = 0; k < 2; k++) {
      const knee =
          -Math.max(0, -Math.sin(d.kick + k * Math.PI)) *
          (0.11 + d.stroke * 0.26),
        co = Math.cos(knee),
        si = Math.sin(knee);
      rig.leg[k].l.material.uniforms.uKnee.value = knee;
      rig.leg[k].f.position.y = -0.12 - 0.142 * co + 0.07 * si;
      rig.leg[k].f.position.z = -0.142 * si - 0.07 * co;
      rig.leg[k].f.rotation.x += knee;
    }
    rig.arm[0].rotation.set(p.armLX, 0, p.armLZ, "ZXY");
    rig.arm[1].rotation.set(p.armRX, 0, p.armRZ, "ZXY");
    const aiming = d.aim > 0.24;
    rig.tool.visible = aiming;
    rig.loaded.visible = d.line.phase === "ready";
    rig.tool.quaternion.copy(p.weapon);
    rig.tool.position.copy(p.grip);
    if (aiming) {
      rig.arm[1].quaternion.copy(p.weapon);
      rig.arm[0].rotation.x += 0.2 * Math.sin(d.kick * 0.32);
    }
    tempStart.copy(p.lamp);
    tempStart.z += rig.wrap.position.z;
    beamTo(
      rig.light,
      tempStart,
      p.light,
      100 * scale,
      0.95 * scale,
      15 * scale,
    );
    const bp = rig.bubbles.geometry.getAttribute(
      "position",
    ) as T.BufferAttribute;
    for (let n = 0; n < 10; n++) {
      const u = (SHARED.uTime.value * 0.33 + n * 0.101 + d.phase) % 1;
      bp.setXYZ(
        n,
        d.x + d.dir * (10 - 8 * u) * scale + Math.sin(u * 8 + n) * 1.3,
        -d.y + u * 37 * scale + 2,
        rig.wrap.position.z + 4,
      );
    }
    bp.needsUpdate = true;
  }
  function update(
    life: ReefResidents,
    t: number,
    cx: number,
    cy: number,
    vw: number,
    vh: number,
  ) {
    SHARED.uLampCount.value = 0;
    subs.forEach((s, i) => {
      const q = life.subs[i];
      const on =
        Math.abs(q.x - cx) < vw / 2 + 340 && Math.abs(q.y - cy) < vh / 2 + 180;
      s.wrap.visible = on;
      s.lights.forEach((l) => (l.visible = on));
      if (!on) return;
      s.wrap.position.set(q.x, -q.y, -150 - (1 - q.depth) * 180);
      s.wrap.scale.setScalar(q.depth);
      s.wrap.rotation.z = -q.pitch * q.dir;
      s.root.rotation.y = subYaw(q.dir, t, i);
      s.prop.rotation.z = t * 10.3;
      s.helm.animate(t + i, -q.dir);
      const frame = rot.set(0, s.root.rotation.y, s.wrap.rotation.z, "ZYX"),
        scale = s.root.scale.x * q.depth;
      for (let k = 0; k < 2; k++) {
        const side = k ? 1 : -1;
        tempStart
          .copy(subLens(side))
          .applyEuler(frame)
          .multiplyScalar(scale)
          .add(s.wrap.position);
        tempEnd.copy(subLightDirection(side, t)).applyEuler(frame);
        beamTo(
          s.lights[k],
          tempStart,
          tempEnd,
          215 * q.depth,
          scale * 0.077,
          34 * q.depth,
        );
      }
    });
    divers.forEach((r, i) => {
      const d = life.divers[i];
      const on =
        d.presence > 0.025 &&
        Math.abs(d.x - cx) < vw / 2 + 145 &&
        Math.abs(d.y - cy) < vh / 2 + 105;
      r.wrap.visible = on;
      r.light.visible = on;
      r.bubbles.visible = on;
      if (on) poseDiver(i, d);
    });
  }
  sea.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.Points) {
      disposables.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        disposables.add(m);
    }
  });
  disposables.add(glass);
  disposables.add(helmetGlass);
  return {
    sea,
    subs,
    divers,
    poseDiver,
    update,
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
