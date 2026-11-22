import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, CircleCheck, Compass, Gamepad2, Layers3, Play, Plus, Settings as SettingsIcon, SlidersHorizontal, Trophy, Volume2, VolumeX, Waves } from "lucide-react";
import { Brand, Coin, Eyebrow, FishCard } from "./components/UI";
import { Guide, Settings, Upgrades, QuickControls } from "./components/Panels";
import { Achievements, Collection } from "./components/Collection";
import { catalog, format, type RunResult } from "./catalog";
import { type Skin } from "./game/species";
import { loadSave, writeSave, type SaveData } from "./save";
import { evaluateUnlocks } from "./trophies";

const HabitatAtlas = lazy(() => import("./components/HabitatAtlas"));
const GameScreen = lazy(() => import("./components/GameScreen"));
const scenes = [
  { image:"/images/sunlit-terraces.webp", name:"Teras Karang", alt:"Kapal selam Jules Verne dan penyelam Mark V melintasi tebing kapur berteras, rumpun karang jingga, dan jalur pasir di bawah cahaya tropis." },
  { image:"/images/coral-garden-canyon.webp", name:"Ngarai Karang", alt:"Lengkungan batu raksasa dan taman karang di Ngarai Karang." },
  { image:"/images/coral-garden-menu.webp", name:"Taman Koral", alt:"Kapal selam melintas di antara koral warna-warni di Taman Koral." },
];
type Page = "Lobi" | "Koleksi Ikan" | "Atlas Laut" | "Pencapaian";
type Panel = "guide" | "settings" | "upgrades" | null;
function pref(key:string, fallback:boolean) { try {const v=localStorage.getItem(key);return v===null?fallback:v==="1";}catch{return fallback;} }
function store(key:string,v:boolean){try{localStorage.setItem(key,v?"1":"0");}catch{/* Storage is optional in private browsing. */}}

export default function App() {
  const [save,setSave]=useState<SaveData>(loadSave), saveRef=useRef(save);
  const [page,setPage]=useState<Page>("Lobi"),[panel,setPanel]=useState<Panel>(null),[playing,setPlaying]=useState(false);
  const [scene,setScene]=useState(0),[toast,setToast]=useState(""),toastTimer=useRef(0);
  const [muted,setMuted]=useState(()=>pref("fishio-muted",false));
  const [motion,setMotion]=useState(()=>pref("fishio-lobby-motion",!window.matchMedia("(prefers-reduced-motion: reduce)").matches));
  const current=catalog.find(s=>s.id===save.skin)||catalog[0];
  const updateSave=(next:SaveData)=>{saveRef.current=next;setSave(next);writeSave(next);};
  const notify=(message:string)=>{window.clearTimeout(toastTimer.current);setToast(message);toastTimer.current=window.setTimeout(()=>setToast(""),2400);};
  const go=(next:Page)=>{setPage(next);setPanel(null);window.scrollTo({top:0,behavior:"instant"});};
  const select=(s:Skin)=>{updateSave({...saveRef.current,skin:s.id});notify(`${s.name} siap berenang`);};
  const toggleAudio=()=>{setMuted(!muted);store("fishio-muted",!muted);};
  const start=()=>{setPanel(null);setToast("");setPlaying(true);};
  const record=(r:RunResult)=>{
    const old=saveRef.current;
    const next={...old,coins:old.coins+r.coins,best:Math.max(old.best,r.score),bestCombo:Math.max(old.bestCombo,r.combo),bestDepth:Math.max(old.bestDepth,r.depth),totalRuns:old.totalRuns+1,rank1Count:old.rank1Count+(r.rank1?1:0),peakLevelCount:old.peakLevelCount+(r.peak!==null?1:0),bestPeakTimeSec:r.peak!==null?Math.min(old.bestPeakTimeSec??Infinity,r.peak):old.bestPeakTimeSec};
    next.unlockedTrophies=evaluateUnlocks(next).nextUnlocked;updateSave(next);
  };
  useEffect(()=>()=>window.clearTimeout(toastTimer.current),[]);
  useEffect(()=>{document.title=playing?"Menjelajah lautan | Fish.io":`${page} | Fish.io: Tropical Reef`;},[page,playing]);
  if(playing) return <Suspense fallback={<div className="boot-screen"><Brand/><span className="loading-line"/><p>Membuka dunia laut...</p></div>}><GameScreen save={save} muted={muted} onMute={toggleAudio} onSetBgStyle={bgStyle=>updateSave({...saveRef.current,bgStyle})} onSetBulkPref={bulkPref=>updateSave({...saveRef.current,bulkPref})} onResult={record} onExit={()=>{setPlaying(false);go("Lobi");}}/></Suspense>;
  return <div className={`app ${motion?"with-motion":"no-motion"}`}>
    <header className="site-header"><div className="header-inner">
      <button className="brand-home" onClick={()=>go("Lobi")} aria-label="Fish.io, kembali ke lobi"><Brand/></button>
      <span className="header-divider"/>
      <nav className="main-nav" aria-label="Navigasi utama">{([{name:"Lobi",icon:Gamepad2},{name:"Koleksi Ikan",icon:Layers3},{name:"Atlas Laut",icon:Compass},{name:"Pencapaian",icon:Trophy}] as const).map(n=><button key={n.name} aria-label={n.name} aria-current={page===n.name?"page":undefined} className={page===n.name?"active":""} onClick={()=>go(n.name)}><n.icon size={17} strokeWidth={1.7}/><span>{n.name}</span></button>)}</nav>
      <div className="header-actions"><button className="coin-counter" title="Koin dan peningkatan ikan" aria-label={`Saldo ${save.coins} koin. Buka peningkatan ikan`} onClick={()=>setPanel("upgrades")}><Coin size={19}/><b>{format(save.coins)}</b><Plus size={12}/></button><span className="action-rule"/><button className={`icon-button sound-toggle ${muted?"muted":""}`} onClick={toggleAudio} aria-label={muted?"Aktifkan suara":"Matikan suara"} title={muted?"Aktifkan suara":"Matikan suara"}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button><button className="icon-button settings-toggle" onClick={()=>setPanel("settings")} aria-label="Buka pengaturan" title="Pengaturan"><SettingsIcon size={18}/></button></div>
    </div></header>
    {page==="Lobi"&&<main>
      <section className="hero" aria-label="Fish.io Tropical Reef">
        <div className="hero-art" key={scene}><img src={scenes[scene].image} alt={scenes[scene].alt} fetchPriority="high"/></div>
        <div className="hero-shade"/>
        {motion&&<div className="ocean-dust" aria-hidden="true">{Array.from({length:13},(_,i)=><i key={i} style={{"--x":`${13+(i*19)%84}%`,"--y":`${10+(i*17)%78}%`,"--d":`${9+i%5}s`,"--offset":`${-i*1.69}s`} as CSSProperties}/>)}</div>}
        <div className="hero-content page-shell">
          <div className="hero-eyebrow"><span className="live-pulse"/>DUNIA LAUT 3D<span className="eyebrow-rule"/></div>
          <h1 className="hero-title">FISH<span>.IO</span></h1>
          <div className="hero-subtitle">TROPICAL REEF</div>
          <p>Susuri teras karang dan temukan dunia yang hidup.<br className="desktop-break"/> Makan, tumbuh, dan kuasai lautan.</p>
          <div className="hero-buttons"><button className="primary-button play-button" onClick={start}><Play size={17} fill="currentColor" strokeWidth={1.5}/>Mulai Bermain</button><button className="hero-guide" onClick={()=>setPanel("guide")}><BookOpen size={17}/>Cara Bermain</button></div>
        </div>
        <div className="hero-carousel"><span className="slide-number">0{scene+1}<i>/</i><small>03</small></span><span className="slide-rule"/><button aria-label="Pemandangan sebelumnya" onClick={()=>setScene((scene+2)%3)}><ChevronLeft size={17}/></button><button aria-label="Pemandangan berikutnya" onClick={()=>setScene((scene+1)%3)}><ChevronRight size={17}/></button></div>
        <span className="sr-only" aria-live="polite">Pemandangan: {scenes[scene].name}</span>
      </section>
      <section className="fish-selection page-shell" aria-labelledby="fish-selection-title">
        <div className="section-heading"><div><Eyebrow>PERSIAPAN BERMAIN</Eyebrow><h2 id="fish-selection-title">Pilih ikanmu<span>.</span></h2></div><button className="collection-link" onClick={()=>go("Koleksi Ikan")}>Lihat semua ikan<span className="collection-count">{catalog.length}</span><ArrowRight size={16}/></button></div>
        <div className="featured-grid">{catalog.slice(0,5).map((skin,i)=><FishCard key={skin.id} skin={skin} selected={save.skin===skin.id} index={i} onSelect={()=>select(skin)}/>)}</div>
        <div className="loadout-line"><div className="active-loadout"><span className="loadout-dot"/><span>Ikan aktif</span><strong>{current.name}</strong><i/><span>{save.name.trim()||"Pemain tamu"}</span><button aria-label="Ubah nama pemain" title="Ubah nama pemain" onClick={()=>setPanel("settings")}><SlidersHorizontal size={13}/></button></div><button className="upgrade-link" onClick={()=>setPanel("upgrades")}><ZapIcon/>Peningkatan ikan<ChevronRight size={14}/></button></div>
      </section>
    </main>}
    {page==="Koleksi Ikan"&&<Collection save={save} select={select} onPlay={start} back={()=>go("Lobi")}/>}
    {page==="Atlas Laut"&&<Suspense fallback={<main className="atlas-page page-shell"><Eyebrow>OBSERVATORIUM</Eyebrow><p>Menyiapkan atlas laut...</p></main>}><HabitatAtlas back={()=>go("Lobi")} onPlay={start}/></Suspense>}
    {page==="Pencapaian"&&<Achievements save={save} onSave={updateSave} back={()=>go("Lobi")}/>}
    <footer className="site-footer page-shell"><span><Waves size={16}/><b>FISH.IO</b><i/>Tropical Reef</span><div><span className="save-note"><CircleCheck size={13}/>Progres tersimpan lokal</span><QuickControls onClick={()=>setPanel("guide")}/></div></footer>
    {panel==="guide"&&<Guide onClose={()=>setPanel(null)}/>}
    {panel==="settings"&&<Settings save={save} muted={muted} motion={motion} onClose={()=>setPanel(null)} onSave={(s,m,a)=>{updateSave({...s,name:s.name.trim()});setMuted(m);setMotion(a);store("fishio-muted",m);store("fishio-lobby-motion",a);setPanel(null);notify("Pengaturan tersimpan");}}/>}
    {panel==="upgrades"&&<Upgrades save={save} onSave={updateSave} onClose={()=>setPanel(null)}/>}
    {toast&&<div className="toast" role="status"><span><Check size={14}/></span>{toast}</div>}
  </div>;
}

function ZapIcon(){return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/></svg>;}