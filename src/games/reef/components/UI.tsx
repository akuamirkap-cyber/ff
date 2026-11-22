import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { Check, X, Fish, Waves } from "lucide-react";
import { type Skin, skinToSpecies } from "../game/species";
import { family, fishArt } from "../catalog";

export function FishMark({ size = 38 }: { size?: number }) {
  return <svg width={size} height={size * .78} viewBox="0 0 48 38" fill="none" aria-hidden="true" className="fish-mark">
    <path d="M7 17 1 10l1.5 17 7-5.5c6 6.8 18.1 10.4 29.5 3.8l7-6.1-7.8-7.2c-4.5-3.2-9-4.3-13.2-4.2L29 2c-8 .6-13.6 3.7-17.4 9.5L7 17Z" fill="currentColor" />
    <path d="m17 26.8 5.6 7.8 6-7.3-11.6-.5Z" fill="currentColor" />
    <path d="m9.4 19 12.1-5.7-4.1 6.1 8.7-1.8-6.8 5.2-9.9-3.8Z" fill="#073331" />
    <circle cx="35.3" cy="15.9" r="2.2" fill="#073331" />
  </svg>;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`brand ${compact ? "compact" : ""}`}><FishMark size={compact ? 30 : 41} /><span>FISH<span className="brand-io">.IO</span></span></span>;
}

export function Coin({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#edb743" /><circle cx="12" cy="12" r="7.7" fill="none" stroke="#8d621a" strokeWidth="1.25" /><path d="m12 6 4.2 6-4.2 6-4.2-6L12 6Z" fill="#ffe49a"/><path d="m12 8 .1 8-2.8-4L12 8Z" fill="#c58a27"/></svg>;
}

export function FishPortrait({ skin, className = "" }: { skin: Skin; className?: string }) {
  return <img className={`fish-portrait ${className}`} src={`/images/fish/${skin.id}.webp`} alt={skin.name + ", " + fishArt(skin).name} draggable="false"
    onError={async e => {
      const img = e.currentTarget;
      if (img.dataset.fallback) return;
      img.dataset.fallback = "1";
      const { spriteDataURL } = await import("../game/sprites");
      if (img.isConnected) img.src = spriteDataURL(skinToSpecies(skin), 300, 0);
    }} />;
}

export function FishCard({ skin, selected, onSelect, index = 0 }: { skin: Skin; selected: boolean; onSelect: () => void; index?: number }) {
  const meta = fishArt(skin);
  return <button className={`fish-card ${selected ? "selected" : ""}`} aria-label={`${selected ? "Terpilih" : "Pilih"}: ${skin.name}, ${meta.name}`} aria-pressed={selected} onClick={onSelect}
    style={{ "--water": meta.color, "--glow": meta.glow, "--delay": `${Math.min(index, 5) * 50}ms` } as CSSProperties}>
    <div className="fish-scene"><div className="water-grain"/><div className="card-caustic"/><FishPortrait skin={skin} /></div>
    <span className="card-kind"><i className={family(skin).toLowerCase()} />{family(skin)}</span>
    {selected && <span className="selected-check"><Check size={12} strokeWidth={3.2} /></span>}
    <div className="fish-caption"><span><strong>{skin.name}</strong><small>{meta.name}</small></span><span className="card-wave">{family(skin) === "Predator" ? <Fish size={20}/> : <Waves size={18}/>}</span></div>
  </button>;
}

export function Eyebrow({ children }: { children: ReactNode }) { return <div className="eyebrow"><span className="eyebrow-line"/>{children}</div>; }

export function Dialog({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close.current(); }
      if (e.key !== "Tab") return;
      const nodes = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href],[tabindex="0"]') || [])].filter(el => el.offsetParent !== null);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {e.preventDefault(); last?.focus();}
      else if (!e.shiftKey && document.activeElement === last) {e.preventDefault(); first?.focus();}
    };
    window.addEventListener("keydown", key, true);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", key, true); previous?.focus(); };
  }, []);
  return <div className="dialog-backdrop" onMouseDown={e => { if(e.target === e.currentTarget) onClose(); }}>
    <div className={`dialog ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
      <button className="icon-button dialog-close" aria-label="Tutup dialog" onClick={onClose}><X size={19}/></button>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}<h2 id={id}>{title}</h2>{children}
    </div>
  </div>;
}

export function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className={`toggle ${on ? "on" : ""}`}><span/></button>;
}