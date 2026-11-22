import { useState } from "react";
import { ArrowLeft, Award, Check, ChevronRight, Compass, Crown, Fish, LockKeyhole, Medal, Play, Search, Sparkles, Trophy, X } from "lucide-react";
import { catalog, family, format } from "../catalog";
import { type Skin } from "../game/species";
import { type SaveData } from "../save";
import { Dialog, Eyebrow, FishCard } from "./UI";
import { TROPHIES, getTrophyProgress, isTrophyMet, type TrophySpec } from "../trophies";

export function Collection({save, select, onPlay, back}:{save:SaveData;select:(s:Skin)=>void;onPlay:()=>void;back:()=>void}) {
  const [filter,setFilter] = useState("Semua"), [query,setQuery]=useState("");
  const visible = catalog.filter(s=>(filter === "Semua" || family(s)===filter) && `${s.name} ${s.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()));
  const chosen = catalog.find(s=>s.id===save.skin)||catalog[0];
  return <main className="library-page page-shell">
    <button className="back-link" onClick={back}><ArrowLeft size={15}/> Kembali ke lobi</button>
    <div className="page-heading"><div><Eyebrow>ENSIKLOPEDIA LAUT</Eyebrow><h1>Koleksi ikan<span>.</span></h1><p>Kenali {catalog.length} karakter laut. Pilih satu untuk petualanganmu.</p></div>
      <button className="primary-button" onClick={onPlay}><Play size={16} fill="currentColor"/>Main dengan {chosen.name}</button></div>
    <div className="collection-tools"><div className="filter-tabs">{["Semua","Terumbu","Predator","Langka"].map(f=><button onClick={()=>setFilter(f)} className={f===filter?"active":""} key={f}>{f}<span>{f==="Semua"?catalog.length:catalog.filter(s=>family(s)===f).length}</span></button>)}</div>
      <label className="search-field"><Search size={16}/><input aria-label="Cari ikan" placeholder="Cari ikan..." value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Hapus pencarian" onClick={()=>setQuery("")}><X size={14}/></button>}</label></div>
    {visible.length ? <div className="collection-grid">{visible.map((s,i)=><FishCard key={s.id} skin={s} selected={s.id===save.skin} index={i} onSelect={()=>select(s)}/>)}</div> : <div className="empty-state"><Fish size={42}/><h3>Ikan tidak ditemukan</h3><p>Coba nama lain atau ubah kategori pencarian.</p><button className="secondary-button" onClick={()=>{setQuery("");setFilter("Semua");}}>Tampilkan semua ikan</button></div>}
  </main>;
}

export function Achievements({save,onSave,back}:{save:SaveData;onSave:(s:SaveData)=>void;back:()=>void}) {
  const [filter,setFilter]=useState("Semua"),[detail,setDetail]=useState<TrophySpec|null>(null);
  const unlocked=(t:TrophySpec)=>!!save.unlockedTrophies[t.id]||isTrophyMet(t,save);
  const earned=TROPHIES.filter(unlocked).length;
  const rows=TROPHIES.filter(t=>filter==="Semua"||(filter==="Terbuka"?unlocked(t):!unlocked(t)));
  const Emblem=detail?.category==="rank1"?Crown:detail?.category==="peak"?Sparkles:Compass;
  return <main className="library-page page-shell">
    <button className="back-link" onClick={back}><ArrowLeft size={15}/> Kembali ke lobi</button>
    <div className="page-heading"><div><Eyebrow>CATATAN EKSPEDISI</Eyebrow><h1>Pencapaian<span>.</span></h1><p>Jejak perjalananmu dari ikan kecil hingga penguasa lautan.</p></div><div className="earned-count"><Trophy size={22}/><b>{earned}</b><span>/ {TROPHIES.length} terbuka</span></div></div>
    <div className="achievement-summary"><span>Skor terbaik <b>{format(save.best)}</b></span><span>Kombo terbaik <b>{save.bestCombo}x</b></span><span>Kedalaman terjauh <b>{format(save.bestDepth)} m</b></span><span>Ekspedisi <b>{save.totalRuns}</b></span></div>
    <div className="filter-tabs trophy-filters">{["Semua","Terbuka","Terkunci"].map(f=><button key={f} className={f===filter?"active":""} onClick={()=>setFilter(f)}>{f}</button>)}</div>
    <div className="trophy-list">{rows.map(t=>{const p=getTrophyProgress(t,save),Icon=t.category==="rank1"?Crown:t.category==="peak"?Sparkles:Compass;
      return <button className={`trophy-row ${unlocked(t)?"earned":""}`} key={t.id} onClick={()=>setDetail(t)}><span className={`medal ${t.rarity}`}><Icon/></span><span className="trophy-copy"><small>{t.rarity}</small><strong>{t.name}</strong><span>{t.requirementText}</span><span className="progress-track"><i style={{width:`${p.pct}%`}}/></span></span><span className="trophy-lock">{unlocked(t)?<Check size={15}/>:<LockKeyhole size={14}/>}</span><ChevronRight size={15}/></button>;
    })}</div>
    {!rows.length&&<div className="empty-state"><Award size={42}/><h3>Petualanganmu baru dimulai</h3><p>Mainkan satu ekspedisi dan kejar pencapaian pertamamu.</p><button className="secondary-button" onClick={back}>Kembali ke lobi</button></div>}
    {detail&&<Dialog title={detail.name} eyebrow={`PIAGAM ${detail.rarity.toUpperCase()}`} onClose={()=>setDetail(null)}><div className="trophy-detail-icon"><Emblem size={52}/></div><p className="dialog-intro">{detail.flavorText}</p><div className="requirement"><Medal size={19}/><span><strong>Misi pencapaian</strong><small>{detail.requirementText}</small></span></div><div className="range-label"><span>Progres</span><b>{getTrophyProgress(detail,save).pct}%</b></div><div className="progress-track"><i style={{width:`${getTrophyProgress(detail,save).pct}%`}}/></div><p className="quiet-note">{getTrophyProgress(detail,save).label}</p><div className="reward"><Trophy size={16}/>Julukan: <strong>{detail.titleReward}</strong></div>{unlocked(detail)?<button className="primary-button full" onClick={()=>{onSave({...save,equippedTitle:detail.titleReward});setDetail(null);}}>Gunakan julukan <Check size={16}/></button>:<button className="secondary-button full" onClick={()=>setDetail(null)}>Kembali ke pencapaian</button>}</Dialog>}
  </main>;
}