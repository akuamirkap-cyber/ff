import { useState } from "react";
import { ArrowRight, AudioLines, Box, Check, Compass, Fish, Gauge, Layers3, LockKeyhole, Mouse, MousePointer2, Pause, Settings2, Shield, Sparkles, Waves, Wind, Zap } from "lucide-react";
import { Dialog, Coin, Toggle } from "./UI";
import { MAX_UPGRADE, UPGRADE_COSTS, type SaveData } from "../save";
import { format } from "../catalog";

export function Guide({ onClose }: {onClose: () => void}) {
  const [tab, setTab] = useState("Kontrol");
  return <Dialog title="Cara bermain" eyebrow="PANDUAN MENYELAM" onClose={onClose}>
    <p className="dialog-intro">Semua penguasa lautan berawal dari ikan kecil.</p>
    <div className="segmented">{["Kontrol", "Ekosistem", "Eksplorasi"].map(t => <button className={t === tab ? "active" : ""} onClick={() => setTab(t)} key={t}>{t}</button>)}</div>
    {tab === "Kontrol" && <div className="guide-list">
      <div><span className="row-icon"><MousePointer2/></span><span><strong>Berenang</strong><small>Arahkan kursor, gunakan WASD, atau geser layar.</small></span></div>
      <div><span className="row-icon"><Waves/></span><span><strong>Sedot makanan <kbd>Spasi</kbd></strong><small>Tahan klik kiri untuk menarik ikan yang lebih kecil.</small></span></div>
      <div><span className="row-icon"><Zap/></span><span><strong>Melaju cepat <kbd>Shift</kbd></strong><small>Tahan klik kanan atau Shift. Lepaskan untuk mengisi energi.</small></span></div>
      <div><span className="row-icon"><Pause/></span><span><strong>Jeda permainan <kbd>Esc</kbd></strong><small>Istirahat sejenak atau simpan hasil dan kembali ke lobi.</small></span></div>
    </div>}
    {tab === "Ekosistem" && <div className="guide-list">
      <div><span className="row-icon"><Fish/></span><span><strong>Makan, lalu tumbuh</strong><small>Sentuh ikan yang lebih kecil untuk memakannya. Hindari predator yang lebih besar.</small></span></div>
      <div><span className="row-icon"><Sparkles/></span><span><strong>Bangun kombo</strong><small>Makan beberapa ikan berurutan untuk mengaktifkan frenzy dan menambah skor.</small></span></div>
      <div><span className="row-icon"><Compass/></span><span><strong>Amati penyelam</strong><small>Satu hingga tiga penyelam menjelajahi terumbu. Garis kuning menandakan mereka sedang membidik ikan.</small></span></div>
      <div><span className="row-icon"><Shield/></span><span><strong>Gunakan perlindungan</strong><small>Batuan menghalangi tombak. Ikan kecil dan sedang yang tertangkap akan ditarik hingga ke tangan penyelam.</small></span></div>
      <div><span className="row-icon"><Zap/></span><span><strong>Waspadai tentakel</strong><small>Ubur-ubur dekat dapat menyengat: arah renang goyah dan turbo berhenti selama 4 detik. Perisai melindungimu, dan ubur-ubur yang jauh aman.</small></span></div>
      <div><span className="row-icon"><Waves/></span><span><strong>Pantul dari kubah ubur-ubur</strong><small>Tabrak bagian atas kepalanya untuk memantul dan berbalik arah. Hanya tentakelnya yang menyengat.</small></span></div>
    </div>}
    {tab === "Eksplorasi" && <div className="guide-list">
      <div><span className="row-icon"><Layers3/></span><span><strong>Empat zona kedalaman</strong><small>Dari Zona Cahaya hingga Palung Abisal, tiap lapisan memiliki lanskap tersendiri: teras kapur, ngarai berkipas, lereng spons, lalu dasar berpasir.</small></span></div>
      <div><span className="row-icon"><Compass/></span><span><strong>Ikuti patroli kapal selam</strong><small>Kapal selam berpindah kedalaman dengan lampu pencari yang menyusuri ngarai.</small></span></div>
      <div><span className="row-icon"><Sparkles/></span><span><strong>Temukan bonus laut</strong><small>Kumpulkan mutiara, turbo, pusaran, dan perisai. Hindari ranjau di perairan terbuka.</small></span></div>
      <div><span className="row-icon"><Gauge/></span><span><strong>Siapkan perjalanan berikutnya</strong><small>Koin dari setiap sesi dapat digunakan untuk meningkatkan kecepatan, sedotan, dan ukuran awal.</small></span></div>
    </div>}
    <button className="primary-button full" onClick={onClose}>Mengerti <Check size={17}/></button>
  </Dialog>;
}

export function Settings({ save, muted, motion, onSave, onClose }: { save: SaveData; muted: boolean; motion: boolean; onSave: (save: SaveData, muted: boolean, motion: boolean) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(save), [quiet, setQuiet] = useState(muted), [animated, setAnimated] = useState(motion);
  return <Dialog title="Pengaturan" eyebrow="PREFERENSI PEMAIN" onClose={onClose}>
    <p className="dialog-intro">Sesuaikan lautan dengan gaya bermainmu.</p>
    <label className="field-label" htmlFor="player-name">Nama pemain</label>
    <input className="text-input" id="player-name" placeholder="Kamu" value={draft.name} maxLength={18} onChange={e => setDraft({...draft, name:e.target.value})}/>
    <span className="field-label" style={{marginTop:14}}>Latar & warna air</span>
    <div className="segmented" style={{marginTop:0,marginBottom:8}} role="group" aria-label="Pilih gaya latar dan warna air">
      <button type="button" className={draft.bgStyle === "game2" ? "active" : ""} onClick={() => setDraft({...draft, bgStyle: "game2"})}>Tropical Reef</button>
      <button type="button" className={draft.bgStyle === "reef_g1" ? "active" : ""} onClick={() => setDraft({...draft, bgStyle: "reef_g1"})}>Reef + Air G1</button>
      <button type="button" className={draft.bgStyle === "game1" ? "active" : ""} onClick={() => setDraft({...draft, bgStyle: "game1"})}>Laut Biru G1</button>
      <button type="button" className={draft.bgStyle === "shipwreck" ? "active" : ""} onClick={() => setDraft({...draft, bgStyle: "shipwreck"})}>⚓ Kapal Karam</button>
      <button type="button" className={draft.bgStyle === "kelp" ? "active" : ""} onClick={() => setDraft({...draft, bgStyle: "kelp"})}>🌿 Hutan Kelp</button>
      <button type="button" className={draft.bgStyle === "temple" ? "active" : ""} onClick={() => setDraft({...draft, bgStyle: "temple"})}>🏛️ Kuil Karang</button>
      <button type="button" className={draft.bgStyle === "lagoon" ? "active" : ""} onClick={() => setDraft({...draft, bgStyle: "lagoon"})}>✨ Laguna Gua</button>
    </div>
    <div className="settings-rows">
      <div><AudioLines/><span><strong>Audio laut</strong><small>Ambiens air dan efek permainan</small></span><Toggle on={!quiet} label="Audio laut" onChange={() => setQuiet(!quiet)}/></div>
      <div><Layers3/><span><strong>Dunia laut 3D</strong><small>Model kapal selam, batuan, dan koral 3D</small></span><Toggle on={draft.laut} label="Dunia laut 3D" onChange={() => setDraft({...draft, laut:!draft.laut})}/></div>
      <div><Box/><span><strong>Karakter ikan 3D</strong><small>Gunakan model 3D pada perangkat yang mendukung</small></span><Toggle on={draft.mode3D} label="Karakter ikan 3D" onChange={() => setDraft({...draft, mode3D:!draft.mode3D})}/></div>
      <div><Wind/><span><strong>Animasi lobi</strong><small>Gerakan air dan karakter di menu utama</small></span><Toggle on={animated} label="Animasi lobi" onChange={() => setAnimated(!animated)}/></div>
    </div>
    <label className="range-label" htmlFor="swim-speed"><span>Kecepatan berenang</span><b>{draft.speedPref.toFixed(1)}x</b></label>
    <input type="range" id="swim-speed" min="0.7" max="1.8" step="0.1" value={draft.speedPref} onChange={e => setDraft({...draft, speedPref:Number(e.target.value)})}/>
    <span className="field-label" style={{marginTop:14}}>Besaran bulk menelan</span>
    <div className="segmented" style={{marginTop:0,marginBottom:8}} role="group" aria-label="Pilih besaran bulk menelan">
      <button type="button" className={Math.abs(draft.bulkPref - 1.0) < 0.05 ? "active" : ""} onClick={() => setDraft({...draft, bulkPref: 1.0})}>1.0x</button>
      <button type="button" className={Math.abs(draft.bulkPref - 1.7) < 0.05 ? "active" : ""} onClick={() => setDraft({...draft, bulkPref: 1.7})}>1.7x (Default)</button>
      <button type="button" className={Math.abs(draft.bulkPref - 2.0) < 0.05 ? "active" : ""} onClick={() => setDraft({...draft, bulkPref: 2.0})}>2.0x</button>
    </div>
    <p className="quiet-note"><Settings2 size={13}/> Kualitas grafis menyesuaikan kemampuan perangkat.</p>
    <button className="primary-button full" onClick={() => onSave(draft,quiet,animated)}>Simpan pengaturan <Check size={16}/></button>
  </Dialog>;
}

const boosts = [
  {key:"suck" as const, name:"Arus sedot", text:"Tarik makanan dari jarak yang lebih jauh.", icon:Waves},
  {key:"speed" as const, name:"Sirip turbo", text:"Tingkatkan kecepatan dan kelincahan berenang.", icon:Zap},
  {key:"size" as const, name:"Ukuran awal", text:"Mulai petualangan dengan tubuh lebih besar.", icon:Fish},
];
export function Upgrades({save, onSave, onClose}:{save:SaveData; onSave:(s:SaveData)=>void; onClose:()=>void}) {
  const [message,setMessage] = useState("");
  return <Dialog title="Peningkatan ikan" eyebrow="PERLENGKAPAN" onClose={onClose}>
    <div className="wallet"><span>Saldo koin</span><strong><Coin/>{format(save.coins)}</strong></div>
    <div className="upgrade-list">{boosts.map(b => {const level=save.upgrades[b.key], max=level>=MAX_UPGRADE, cost=UPGRADE_COSTS[level]||0;
      return <div key={b.key}><span className="row-icon"><b.icon/></span><div className="upgrade-copy"><strong>{b.name}</strong><small>{b.text}</small><span className="level-segments" aria-label={`Level ${level} dari ${MAX_UPGRADE}`}>{Array.from({length:MAX_UPGRADE},(_,i)=><i className={i<level?"filled":""} key={i}/>)}</span></div>
        <button className="cost-button" disabled={max||save.coins<cost} aria-label={`Tingkatkan ${b.name}, ${cost} koin`} onClick={()=>{if(max||save.coins<cost)return;onSave({...save,coins:save.coins-cost,upgrades:{...save.upgrades,[b.key]:level+1}});setMessage(`${b.name} naik ke level ${level+1}.`);}}>{max?<Check size={15}/>:<><Coin size={15}/>{cost}</>}</button></div>;
    })}</div>
    <p className="quiet-note" role="status">{message?<><Check size={14}/>{message}</>:<><LockKeyhole size={14}/>Kumpulkan koin saat bermain untuk meningkatkan kemampuan.</>}</p>
    <button className="secondary-button full" onClick={onClose}>Kembali <ArrowRight size={16}/></button>
  </Dialog>;
}

export function QuickControls({onClick}:{onClick:()=>void}) {
  return <button className="quick-controls" onClick={onClick}><Mouse size={16}/><span>Panduan kontrol</span><ArrowRight size={13}/></button>;
}