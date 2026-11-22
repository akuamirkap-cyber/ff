import * as T from "three";
import { FILAMENTS, JOINTS, JELLY_COLORS, type Medusa } from "../medusae";

const TAU = Math.PI * 2,
  SIDES = 5;
function bell() {
  const pos: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  const cols = 48,
    rows = 20;
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const u = i / cols,
        v = j / rows,
        a = u * TAU,
        p = v * Math.PI * 0.57;
      const r = Math.sin(p) * (1 + 0.024 * Math.cos(a * 16) * v ** 4),
        y = 0.74 * Math.cos(p) + 0.162 + 0.026 * Math.cos(a * 24) * v ** 6;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r * 0.94);
      uv.push(u, v);
      if (i < cols && j < rows) {
        const k = j * (cols + 1) + i;
        idx.push(k, k + 1, k + cols + 2, k, k + cols + 2, k + cols + 1);
      }
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function makeMedusaRig() {
  const root = new T.Group(),
    body = new T.Group(),
    canopy = new T.Group();
  root.add(body);
  body.add(canopy);
  const skin = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    uniforms: {
      uColor: { value: new T.Color(JELLY_COLORS[0]) },
      uPhase: { value: 0 },
      uDistant: { value: 1 },
    },
    vertexShader: `varying vec2 vUv;varying vec3 vN;varying vec3 vP;void main(){vUv=uv;vN=normalize(normalMatrix*normal);vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;varying vec3 vN;varying vec3 vP;uniform vec3 uColor;uniform float uPhase,uDistant;
    void main(){vec3 n=normalize(vN);float f=pow(1.-abs(n.z),1.85);float meridian=vUv.x*50.2655+sin(vUv.y*7.+vUv.x*12.)*.65;
    float vein=pow(.5+.5*cos(meridian),48.);float branch=pow(.5+.5*cos(meridian*2.+vUv.y*11.),30.)*smoothstep(.39,.91,vUv.y);
    float glint=pow(max(dot(n,normalize(vec3(-.46,.76,.52))),0.),18.);float hem=smoothstep(.91,.995,vUv.y);
    float lace=.5+.5*cos(vUv.x*150.796);float flow=.5+.5*sin(vUv.y*12.-uPhase);
    vec3 c=mix(uColor,vec3(.73,.93,1.),.18+.55*f);c=mix(c,vec3(.91,.57,.76),.22*flow*(1.-vUv.y));
    float pulse=.70+.30*sin(uPhase*1.45+vUv.y*7.);
    float beads=pow(.5+.5*cos(vUv.x*75.398+sin(vUv.y*15.)*.5),34.)*smoothstep(.35,.9,vUv.y);
    float biolum=(vein*.46+branch*.28+hem*(.48+.35*lace)+beads*.31)*pulse;
    c+=glint*.60+biolum*mix(vec3(.69,.96,1.),uColor,.37);
    float a=(.20+.32*f+.20*vein+.14*branch+.38*hem+.28*glint)*uDistant;
    gl_FragColor=vec4(c,clamp(a,0.,.87));}`,
  });
  const shell = new T.Mesh(bell(), skin);
  shell.renderOrder = 43;
  canopy.add(shell);
  const innerMat = new T.MeshBasicMaterial({
    color: 0xe7ccff,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const inner = new T.Mesh(
    new T.SphereGeometry(1, 28, 16, 0, TAU, 0, Math.PI * 0.53),
    new T.MeshBasicMaterial({
      color: 0xe3b8e5,
      transparent: true,
      opacity: 0.18,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  inner.position.y = 0.12;
  inner.scale.set(0.77, 0.55, 0.76);
  inner.renderOrder = 40;
  canopy.add(inner);
  const petals = new T.Group();
  petals.rotation.x = 0.81;
  petals.rotation.z = 0.42;
  petals.position.y = 0.31;
  canopy.add(petals);
  const ring = new T.TorusGeometry(0.133, 0.035, 7, 20, Math.PI * 1.65);
  for (let i = 0; i < 4; i++) {
    const m = new T.Mesh(ring, innerMat);
    const a = i * Math.PI * 0.5;
    m.position.set(Math.cos(a) * 0.147, Math.sin(a) * 0.147, 0);
    m.rotation.z = a + 0.65;
    m.scale.set(1, 0.69, 1);
    m.renderOrder = 41;
    petals.add(m);
  }
  const haze = new T.Mesh(
    new T.PlaneGeometry(2.7, 2.3),
    new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      uniforms: { uTint: skin.uniforms.uColor },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv;uniform vec3 uTint;void main(){float r=length((vUv-.5)*2.);gl_FragColor=vec4(uTint,.21*(1.-smoothstep(.15,1.,r)));}`,
    }),
  );
  haze.position.set(0, 0.28, -0.2);
  haze.renderOrder = 38;
  canopy.add(haze);
  const photophores = new T.BufferGeometry();
  const lights: number[] = [];
  for (let i = 0; i < 31; i++) {
    const a = i * 2.399963, rad = Math.sqrt((i + .4) / 31) * .78;
    lights.push(Math.cos(a) * rad, .33 + .31 * Math.sqrt(1 - rad * rad), Math.sin(a) * rad * .67);
  }
  photophores.setAttribute("position", new T.Float32BufferAttribute(lights, 3));
  const pearls = new T.Points(photophores, new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { uColor: skin.uniforms.uColor, uPhase: skin.uniforms.uPhase },
    vertexShader: `varying float twinkle;uniform float uPhase;void main(){twinkle=.57+.43*sin(uPhase*1.7+position.x*31.+position.z*17.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(2.2+twinkle*2.8,2.,5.);}`,
    fragmentShader: `varying float twinkle;uniform vec3 uColor;void main(){float r=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.12,1.,r))*twinkle*.83;gl_FragColor=vec4(mix(uColor,vec3(.90,1.,1.),.68),a);}`
  }));
  pearls.renderOrder = 44;
  canopy.add(pearls);
  const ribbons: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>[] = [];
  for (let n = 0; n < 4; n++) {
    const geo = new T.BufferGeometry();
    geo.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(17 * 2 * 3), 3).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    const ids: number[] = [];
    for (let k = 0; k < 16; k++) {
      const o = k * 2;
      ids.push(o, o + 1, o + 3, o, o + 3, o + 2);
    }
    geo.setIndex(ids);
    const ribbon = new T.Mesh(
      geo,
      new T.MeshBasicMaterial({
        color: 0xdcc5ff,
        transparent: true,
        opacity: 0.42,
        blending: T.AdditiveBlending,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    ribbon.renderOrder = 40;
    ribbon.frustumCulled = false;
    ribbons.push(ribbon);
    body.add(ribbon);
  }
  const geo = new T.BufferGeometry(),
    pos = new Float32Array(FILAMENTS * JOINTS * SIDES * 3),
    ids: number[] = [];
  for (let n = 0; n < FILAMENTS; n++)
    for (let k = 0; k < JOINTS - 1; k++)
      for (let a = 0; a < SIDES; a++) {
        const o = (n * JOINTS + k) * SIDES,
          l = o + a,
          r = o + ((a + 1) % SIDES);
        ids.push(l, r, r + SIDES, l, r + SIDES, l + SIDES);
      }
  const attr = new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage);
  geo.setAttribute("position", attr);
  geo.setIndex(ids);
  const filMat = new T.ShaderMaterial({
    uniforms: { uColor: skin.uniforms.uColor, uPhase: skin.uniforms.uPhase, uDistant: skin.uniforms.uDistant },
    transparent: true, depthWrite: false, side: T.DoubleSide,
    blending: T.AdditiveBlending,
    vertexShader: `varying float height;void main(){height=clamp(-position.y/2.8,0.,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 uColor;uniform float uPhase,uDistant;varying float height;void main(){float k=.63+.37*sin(uPhase*2.4-height*16.);gl_FragColor=vec4(mix(uColor,vec3(.72,1.,1.),.58),(.34+.46*k)*(1.-height*.42)*uDistant);}`
  });
  const tentacles = new T.Mesh(geo, filMat);
  tentacles.renderOrder = 39;
  tentacles.frustumCulled = false;
  root.add(tentacles);
  function pose(j: Medusa) {
    root.position.set(j.x, -j.y, j.near ? 78 : -194);
    root.scale.setScalar(j.r);
    body.rotation.z = -j.tilt;
    canopy.scale.set(
      1 - j.pulse * 0.17,
      1 + j.pulse * 0.15,
      1 - j.pulse * 0.17,
    );
    skin.uniforms.uColor.value.set(JELLY_COLORS[j.color]);
    skin.uniforms.uPhase.value = j.phase;
    skin.uniforms.uDistant.value = j.near ? 1 : 0.7;
    innerMat.color.set(JELLY_COLORS[j.color]).lerp(new T.Color(0xffded1), 0.47);
    // Uniforms share the bell's color, pulse and distance fade.
    for (let n = 0; n < 4; n++) {
      const a = (n * TAU) / 4 + 0.6,
        at = ribbons[n].geometry.getAttribute("position") as T.BufferAttribute;
      ribbons[n].material.color.copy(skin.uniforms.uColor.value);
      ribbons[n].material.opacity = j.near ? 0.49 : 0.27;
      for (let k = 0; k <= 16; k++) {
        const u = k / 16,
          angle = a + u * 3.4 + 0.28 * Math.sin(j.phase * 0.7 - u * 3.8),
          radius = 0.14 + 0.13 * u;
        const x =
            Math.cos(angle) * radius + 0.16 * Math.sin(j.phase - u * 4 + n) * u,
          y = 0.19 - 1.61 * u,
          z = Math.sin(angle) * radius;
        const width =
          (0.11 + 0.17 * Math.sin(Math.PI * u)) *
          (0.68 + 0.31 * Math.cos(u * 39 + n)) *
          (1 - u * 0.73);
        at.setXYZ(
          k * 2,
          x - Math.cos(angle) * width,
          y + 0.022 * Math.sin(u * 23),
          z - Math.sin(angle) * width,
        );
        at.setXYZ(
          k * 2 + 1,
          x + Math.cos(angle) * width,
          y - 0.025 * Math.sin(u * 21),
          z + Math.sin(angle) * width,
        );
      }
      at.needsUpdate = true;
    }
    if (tentacles.visible)
      for (let n = 0; n < FILAMENTS; n++)
        for (let k = 0; k < JOINTS; k++) {
          const pt = (n * JOINTS + k) * 3,
            r = (0.021 + 0.005 * (n % 3)) * (1 - (0.75 * k) / (JOINTS - 1));
          for (let a = 0; a < SIDES; a++) {
            const id = ((n * JOINTS + k) * SIDES + a) * 3;
            pos[id] = j.points[pt] + Math.cos((a * TAU) / SIDES) * r;
            pos[id + 1] = -j.points[pt + 1];
            pos[id + 2] = j.points[pt + 2] + Math.sin((a * TAU) / SIDES) * r;
          }
        }
    attr.needsUpdate = true;
  }
  function dispose() {
    const gs = new Set<T.BufferGeometry>(),
      ms = new Set<T.Material>();
    root.traverse((x) => {
      if (x instanceof T.Mesh || x instanceof T.Points) {
        gs.add(x.geometry);
        ms.add(x.material);
      }
    });
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => m.dispose());
  }
  return { root, body, canopy, tentacles, pose, dispose };
}

export class MedusaRenderer {
  private pool: ReturnType<typeof makeMedusaRig>[] = [];
  constructor(
    private far: T.Scene,
    private near: T.Scene,
  ) {}
  update(animals: Medusa[], cx: number, cy: number, vw: number, vh: number) {
    let slot = 0;
    for (const j of animals) {
      if (Math.abs(j.x - cx) > vw / 2 + 45 || Math.abs(j.y - cy) > vh / 2 + 78)
        continue;
      const rig = this.pool[slot] || (this.pool[slot] = makeMedusaRig());
      const scene = j.near ? this.near : this.far;
      if (rig.root.parent !== scene) scene.add(rig.root);
      rig.root.visible = true;
      rig.pose(j);
      slot++;
    }
    for (; slot < this.pool.length; slot++)
      this.pool[slot].root.visible = false;
  }
  dispose() {
    this.pool.forEach((p) => p.dispose());
    this.pool = [];
  }
}
