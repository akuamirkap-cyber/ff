import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  ExternalLink,
  Hand,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  ScanLine,
} from "lucide-react";
import { Eyebrow } from "./UI";
import type { Formation, RockSDF } from "../game/ocean";
import type { Group, WebGLRenderer } from "three";

const specimens = [
  {
    tab: "Terumbu",
    title: "Teras kapur",
    category: "Bentang laut",
    description:
      "Sebelas bentuk karang tumbuh di teras batu. Temukan koral gelembung, cambuk laut, anemon, pipa organ, selada laut, ikan kecil, dan udang.",
    image: "reef",
  },
  {
    tab: "Penyelam",
    title: "Penyelam Mark V",
    category: "Kru ekspedisi",
    description:
      "Helm tembaga, cincin kuningan, dan pakaian selam kanvas. Amati wajah dari jendela depan serta tabung udara dari belakang.",
    image: "diver",
  },
  {
    tab: "Pengemudi",
    title: "Captain Ashford",
    category: "Kokpit kapal selam",
    description:
      "Sang kapten berada di balik kubah kaca, tanpa helm atau topi tambahan. Perbesar untuk melihat wajah dan kemudi delapan ruasnya.",
    image: "pilot",
  },
] as const;
interface ViewState {
  index: number;
  yaw: number;
  pitch: number;
  zoom: number;
  playing: boolean;
  dirty: boolean;
}
const angles = [0.32, -0.17, -0.35];

export default function HabitatAtlas({
  back,
  onPlay,
}: {
  back: () => void;
  onPlay: () => void;
}) {
  const [index, setIndex] = useState(0),
    [status, setStatus] = useState<"loading" | "ready" | "still">("loading");
  const [play, setPlay] = useState(
      () => !matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [zoom, setZoom] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null),
    drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const state = useRef<ViewState>({
    index: 0,
    yaw: angles[0],
    pitch: 0.22,
    zoom: 1,
    playing: play,
    dirty: true,
  });
  const item = specimens[index];
  function reset(i = index) {
    state.current.yaw = angles[i];
    state.current.pitch = i === 0 ? 0.22 : 0.06;
    state.current.zoom = 1;
    state.current.dirty = true;
    setZoom(1);
  }
  const choose = (i: number) => {
    state.current.index = i;
    setIndex(i);
    reset(i);
  };
  const scale = (by: number) => {
    const z = Math.max(0.72, Math.min(2.4, state.current.zoom * by));
    state.current.zoom = z;
    state.current.dirty = true;
    setZoom(z);
  };
  const pause = () => {
    state.current.playing = !state.current.playing;
    setPlay(state.current.playing);
    state.current.dirty = true;
  };
  useEffect(() => {
    let alive = true,
      raf = 0,
      renderer: WebGLRenderer | undefined,
      observer: ResizeObserver | undefined;
    const dispose: (() => void)[] = [];
    const abort = new AbortController();
    const cv = canvas.current;
    if (!cv) return;
    const onLoss = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      if (alive) setStatus("still");
    };
    cv.addEventListener("webglcontextlost", onLoss);
    const init = async () => {
      const [
        T,
        { ReefGarden },
        { createExpeditionRigs },
        { ReefResidents },
        { SHARED },
        { ReefLifeRenderer },
      ] = await Promise.all([
        import("three"),
        import("../game/laut/reefEcology"),
        import("../game/laut/expeditionRigs"),
        import("../game/residents"),
        import("../game/laut/glsl"),
        import("../game/reefInhabitants"),
      ]);
      if (!alive) return;
      renderer = new T.WebGLRenderer({
        canvas: cv,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setClearColor(0, 0);
      renderer.setPixelRatio(1);
      const gl = renderer.getContext(),
        info = gl.getExtension("WEBGL_debug_renderer_info");
      const software = /SwiftShader|llvmpipe|softpipe|Software/i.test(
        String(
          gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
        ),
      );
      const response = await fetch("/models/lagoon-surface.json", {
        signal: abort.signal,
      });
      if (!response.ok) throw Error("Habitat survey unavailable");
      const f: Formation = await response.json();
      if (!alive) return;
      for (const field of [f.sdfSolid, f.sdfCave] as RockSDF[])
        field.data = Float32Array.from(field.data, (v) => v / 16);
      const gardens = new ReefGarden();
      dispose.push(() => gardens.dispose());
      const reef = gardens.formation(f),
        micro = new ReefLifeRenderer(reef.root.userData.fauna),
        rig = createExpeditionRigs();
      reef.root.add(micro.group);
      dispose.push(() => micro.dispose(), () => rig.dispose());
      await gardens.scans.done;
      if (!alive) return;
      const life = new ReefResidents();
      life.reset(0, 0);
      const d = life.divers[0];
      Object.assign(d, {
        x: 0,
        y: 0,
        dir: 1,
        depth: 1,
        presence: 1,
        yaw: -2.78,
        head: 1,
        wave: 0,
        aim: 0,
        stroke: 0.18,
        pitch: 0,
        baseScale: 30.4,
      });
      rig.poseDiver(0, d);
      const diver = rig.divers[0].wrap;
      diver.visible = true;
      const sub = rig.subs[0];
      sub.root.rotation.set(0, Math.PI * 0.67, 0);
      sub.root.scale.setScalar(48);
      sub.helm.animate(0, 1);
      const subjects: Group[] = [reef.root, diver, sub.root];
      const scene = new T.Scene();
      subjects.forEach((o) => scene.add(o));
      const camera = new T.PerspectiveCamera(32, 1, 0.1, 5000),
        center = new T.Vector3(),
        shipTarget = new T.Vector3();
      sub.root.updateMatrixWorld(true);
      shipTarget.set(0, 0.02, -2.04);
      sub.root.localToWorld(shipTarget);
      const pivot = [
        new T.Vector3(f.x + f.cxl, -(f.y + f.cyl) + 3, 0),
        new T.Vector3(0, 1, -95),
        shipTarget,
      ];
      const spans = [f.rx * 1.74, 48, 70];
      let w = 0,
        h = 0,
        t = 1.05,
        last = 0;
      const resize = () => {
        const box = cv.getBoundingClientRect();
        w = Math.max(1, box.width);
        h = Math.max(1, box.height);
        const ratio = Math.min(
          devicePixelRatio || 1,
          1.5,
          Math.sqrt((software ? 310000 : 740000) / (w * h)),
        );
        renderer?.setSize(Math.round(w * ratio), Math.round(h * ratio), false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        state.current.dirty = true;
      };
      observer = new ResizeObserver(resize);
      observer.observe(cv);
      resize();
      setStatus("ready");
      const frame = (now: number) => {
        if (!alive) return;
        raf = requestAnimationFrame(frame);
        const s = state.current;
        if (
          document.hidden ||
          (!s.dirty && !s.playing) ||
          (!s.dirty && now - last < (software ? 64 : 40))
        )
          return;
        const dt = Math.min(0.08, (now - last) / 1000);
        last = now;
        if (s.playing) {
          t += dt;
          if (!drag.current) s.yaw += dt * 0.038;
        }
        SHARED.uTime.value = t;
        SHARED.uLampCount.value = 0;
        SHARED.uReefView.value.set(0, 0);
        s.dirty = false;
        subjects.forEach((o, i) => (o.visible = s.index === i));
        if (s.index === 0) micro.update(t, f.x + f.cxl, f.y + f.cyl, f.rx * 2.5, f.ry * 4);
        if (s.index === 1) {
          d.kick = t * 2.4;
          d.wave = 0.42 + 0.41 * Math.sin(t * 0.62);
          rig.poseDiver(0, d);
        }
        if (s.index === 2) {
          sub.helm.animate(t, 1);
          sub.prop.rotation.z = t * 2;
        }
        const span =
          (spans[s.index] / s.zoom) *
          (s.index === 0 ? Math.max(1, 1.64 / camera.aspect) : 1);
        const distance = (span * 0.5) / Math.tan((16 * Math.PI) / 180);
        center.copy(pivot[s.index]);
        camera.position.set(
          center.x + Math.sin(s.yaw) * Math.cos(s.pitch) * distance,
          center.y + Math.sin(s.pitch) * distance,
          center.z + Math.cos(s.yaw) * Math.cos(s.pitch) * distance,
        );
        camera.lookAt(center);
        renderer!.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);
    };
    init().catch(() => {
      if (alive) setStatus("still");
    });
    return () => {
      alive = false;
      abort.abort();
      cancelAnimationFrame(raf);
      observer?.disconnect();
      cv.removeEventListener("webglcontextlost", onLoss);
      dispose.forEach((fn) => fn());
      renderer?.dispose();
      renderer?.forceContextLoss();
    };
  }, []);
  return (
    <main className="atlas-page page-shell">
      <button className="back-link" onClick={back}>
        <ArrowLeft size={15} /> Kembali ke lobi
      </button>
      <div className="atlas-heading">
        <div>
          <Eyebrow>OBSERVATORIUM</Eyebrow>
          <h1>
            Atlas laut<span>.</span>
          </h1>
        </div>
        <button className="primary-button" onClick={onPlay}>
          <Play size={15} fill="currentColor" />
          Mulai Bermain
        </button>
      </div>
      <div className="atlas-tools">
        <div className="atlas-tabs" aria-label="Objek pengamatan">
          {specimens.map((s, i) => (
            <button
              key={s.tab}
              className={i === index ? "active" : ""}
              aria-pressed={i === index}
              onClick={() => choose(i)}
            >
              {s.tab}
            </button>
          ))}
        </div>
        <span className="atlas-mode">
          <ScanLine size={14} />
          {status === "still" ? "Render model asli" : "Inspeksi 3D"}
        </span>
      </div>
      <section className="atlas-stage" aria-label={item.title}>
        {status !== "ready" && (
          <img
            className="atlas-still"
            src={`/images/atlas-${item.image}.webp`}
            alt={item.title}
          />
        )}
        <canvas
          ref={canvas}
          className={status === "ready" ? "visible" : ""}
          tabIndex={status === "ready" ? 0 : -1}
          aria-label={`Model ${item.title}. Geser atau gunakan tombol panah untuk memutar.`}
          onPointerDown={(e) => {
            if (status !== "ready") return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            const s = state.current;
            s.yaw -= (e.clientX - d.x) * 0.006;
            s.pitch = Math.max(
              -0.25,
              Math.min(0.89, s.pitch + (e.clientY - d.y) * 0.005),
            );
            d.x = e.clientX;
            d.y = e.clientY;
            s.dirty = true;
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onLostPointerCapture={() => (drag.current = null)}
          onKeyDown={(e) => {
            const s = state.current;
            if (
              ![
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "+",
                "-",
                "Home",
              ].includes(e.key)
            )
              return;
            e.preventDefault();
            if (e.key === "Home") reset();
            if (e.key === "+") scale(1.16);
            if (e.key === "-") scale(1 / 1.16);
            if (e.key === "ArrowLeft") s.yaw -= 0.15;
            if (e.key === "ArrowRight") s.yaw += 0.15;
            if (e.key === "ArrowUp") s.pitch = Math.min(0.89, s.pitch + 0.12);
            if (e.key === "ArrowDown")
              s.pitch = Math.max(-0.25, s.pitch - 0.12);
            s.dirty = true;
          }}
        />
        <div className="atlas-bottom">
          <span>
            <Hand size={14} />
            {status === "loading"
              ? "Menyiapkan model..."
              : status === "still"
                ? "Pratinjau statis, WebGL tidak tersedia"
                : "Geser untuk memutar"}
          </span>
          <div className="atlas-camera">
            <button
              aria-label="Perkecil model"
              disabled={status !== "ready" || zoom <= 0.72}
              onClick={() => scale(1 / 1.2)}
            >
              <Minus size={15} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              aria-label="Perbesar model"
              disabled={status !== "ready" || zoom >= 2.4}
              onClick={() => scale(1.2)}
            >
              <Plus size={15} />
            </button>
            <i />
            <button
              aria-label={play ? "Jeda putaran" : "Lanjutkan putaran"}
              disabled={status !== "ready"}
              onClick={pause}
            >
              {play ? <Pause size={14} /> : <RotateCw size={14} />}
            </button>
            <button
              aria-label="Atur ulang sudut pandang"
              disabled={status !== "ready"}
              onClick={() => reset()}
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </section>
      <div className="atlas-caption">
        <div>
          <span className="atlas-index">0{index + 1} / 03</span>
          <span className="atlas-category">{item.category}</span>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
        </div>
        <button
          className="atlas-next"
          onClick={() => choose((index + 1) % 3)}
          aria-label="Amati objek berikutnya"
        >
          <ArrowRight size={21} />
        </button>
      </div>
      <div className="atlas-credit">
        <span>
          <Compass size={13} />
          Spesimen dari dunia permainan
        </span>
        {index === 0 ? (
          <a
            href="https://polyhaven.com/a/rock_face_03"
            target="_blank"
            rel="noreferrer"
          >
            Material: Poly Haven <ExternalLink size={11} />
          </a>
        ) : (
          <a
            href="https://github.com/akuamirkap-cyber/STIKFICK/blob/main/PENYELAM.zip"
            target="_blank"
            rel="noreferrer"
          >
            Model asli: PENYELAM <ExternalLink size={11} />
          </a>
        )}
      </div>
    </main>
  );
}
