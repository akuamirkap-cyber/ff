import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Compass, Flag, Gauge, Map, Pause, Play, RotateCcw, Shield, Trophy, Volume2, VolumeX, Waves, Zap } from "lucide-react";
import { Game, type DeathInfo, type HudState } from "../game/engine";
import { isSoftwareWebGL } from "../game/fish3d";
import { sfx } from "../game/audio";
import { depthMeters } from "../game/ocean";
import { type SaveData } from "../save";
import { catalog, format, type RunResult } from "../catalog";
import { Brand, Coin, Dialog, Eyebrow, FishPortrait } from "./UI";

type Props = {save:SaveData;muted:boolean;onMute:()=>void;onSetBgStyle:(style:SaveData["bgStyle"])=>void;onSetBulkPref:(bulkPref:number)=>void;onResult:(r:RunResult)=>void;onExit:()=>void};
type Phase = "loading"|"play"|"pause"|"over"|"error";

export default function GameScreen(props:Props) {
  const latest=useRef(props);latest.current=props;
  const cv=useRef<HTMLCanvasElement>(null), minimap=useRef<HTMLCanvasElement>(null), game=useRef<Game|null>(null);
  const [phase,setPhase]=useState<Phase>("loading"),phaseRef=useRef<Phase>("loading");
  const [pct,setPct]=useState(0),[hud,setHud]=useState<HudState|null>(null),[death,setDeath]=useState<DeathInfo|null>(null);
  const [message,setMessage]=useState(""),[board,setBoard]=useState(false),[showMap,setShowMap]=useState(false),[lightMode,setLightMode]=useState(false);
  const recorded=useRef(false),started=useRef(false),timer=useRef(0);
  const skin=catalog.find(s=>s.id===props.save.skin)||catalog[0];
  const change=(p:Phase)=>{phaseRef.current=p;setPhase(p);};
  const say=useCallback((text:string,duration=3200)=>{window.clearTimeout(timer.current);setMessage(text);timer.current=window.setTimeout(()=>setMessage(""),duration);},[]);
  const record=useCallback(()=>{
    const g=game.current;if(!g||!started.current||recorded.current)return;
    recorded.current=true;latest.current.onResult({score:g.arcadeScore,coins:g.sessionCoins,combo:g.maxCombo,depth:depthMeters(g.maxDepthY),rank1:g.reachedRank1,peak:g.peakLevelTime});
  },[]);
  const exit=()=>{record();latest.current.onExit();};
  const pause=useCallback(()=>{
    const g=game.current;if(!g||phaseRef.current!=="play")return;
    g.paused=true;g.setBoost(false);g.setSuck(false);sfx.setMuted(true);change("pause");
  },[]);
  const resume=()=>{const g=game.current;if(!g)return;g.last=performance.now();g.paused=false;g.mouse.active=false;sfx.setMuted(latest.current.muted);change("play");};
  const begin=useCallback(()=>{
    const g=game.current;if(!g?.ready)return;
    const s=latest.current.save,chosen=catalog.find(k=>k.id===s.skin)||catalog[0];
    recorded.current=false;started.current=true;setDeath(null);setBoard(false);setShowMap(false);
    g.paused=false;g.setSuck(false);g.setBoost(false);g.mouse.active=false;g.last=performance.now();
    sfx.setMuted(latest.current.muted);g.start({name:s.name||"Kamu",skin:{...chosen,is3D:s.mode3D&&!isSoftwareWebGL()},upgrades:s.upgrades,speedScale:s.speedPref,bulkScale:s.bulkPref});
    change("play");say("Makan ikan kecil untuk tumbuh. Hindari predator yang lebih besar.",5500);
  },[say]);
  useEffect(()=>{
    if(!cv.current)return;
    document.body.style.overflow="hidden";
    let g:Game;
    try {
      const soft=isSoftwareWebGL(),s=latest.current.save;
      setLightMode(soft||!s.laut);sfx.setMuted(latest.current.muted);sfx.init();
      g=new Game(cv.current,{laut:s.laut&&!soft,reef3D:false,pixelMode:false,bgStyle:s.bgStyle});
      game.current=g;g.setMenuMode(false);
      g.onLoad=(p,ready)=>{setPct(Math.round(p*100));if(ready&&!started.current)begin();};
      g.onHud=setHud;
      g.onLautFailed=()=>{setLightMode(true);say("Mode ringan aktif. Petualangan tetap berlanjut.");};
      g.onDeath=d=>{record();setDeath(d);g.paused=true;g.setBoost(false);g.setSuck(false);sfx.setMuted(true);setMessage("");change("over");};
      g.onEvent=e=>{if(e.type==="feed")say(e.text);else if(e.type==="levelup")say(`Naik ukuran! ${e.text}`);else if(e.type==="frenzy")say(`Frenzy! Kombo ${e.n}x`);else if(e.type==="bonus")say(`${e.title}: ${e.text}`);else if(e.type==="rank1")say("Peringkat pertama! Kamu menguasai lautan.");else if(e.type==="peaklevel")say("Puncak evolusi tercapai!");};
      if(import.meta.env.DEV)(window as Window&{__reefGame?:Game}).__reefGame=g;
    }catch(error){console.error("Cannot initialize ocean",error);change("error");return()=>{document.body.style.overflow="";};}
    const pressed=new Set<string>();
    const moveKeys=()=>{
      const dx=Number(pressed.has("d")||pressed.has("arrowright"))-Number(pressed.has("a")||pressed.has("arrowleft"));
      const dy=Number(pressed.has("s")||pressed.has("arrowdown"))-Number(pressed.has("w")||pressed.has("arrowup"));
      if(!dx&&!dy){g.mouse.active=false;return;}
      g.mouse.active=true;g.mouse.x=window.innerWidth*(.5+dx*.38);g.mouse.y=window.innerHeight*(.5+dy*.38);
    };
    const down=(e:KeyboardEvent)=>{
      if(phaseRef.current!=="play")return;
      const k=e.key.toLowerCase();
      if(k==="escape"||k==="p"){e.preventDefault();pause();return;}
      if(k==="m"&&!e.repeat){setShowMap(v=>!v);return;}
      if(k===" "||k==="shift"){e.preventDefault();if(k===" ")g.setSuck(true);else g.setBoost(true);}
      if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k)){e.preventDefault();pressed.add(k);moveKeys();}
    };
    const up=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();if(k===" ")g.setSuck(false);if(k==="shift")g.setBoost(false);if(pressed.delete(k))moveKeys();};
    const release=()=>{g.setSuck(false);g.setBoost(false);};
    const hide=()=>{if(document.hidden){pressed.clear();pause();}};
    const resize=()=>g.resize(true);
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("pointerup",release);window.addEventListener("pointercancel",release);
    window.addEventListener("blur",pause);window.addEventListener("resize",resize);window.addEventListener("pagehide",record);document.addEventListener("visibilitychange",hide);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("pointerup",release);window.removeEventListener("pointercancel",release);window.removeEventListener("blur",pause);window.removeEventListener("resize",resize);window.removeEventListener("pagehide",record);document.removeEventListener("visibilitychange",hide);window.clearTimeout(timer.current);g.destroy();game.current=null;if(import.meta.env.DEV)delete (window as Window&{__reefGame?:Game}).__reefGame;document.body.style.overflow="";};
  },[begin,pause,record,say]);
  useEffect(()=>{if(game.current)game.current.minimap=showMap?minimap.current:null;},[showMap,phase]);
  useEffect(()=>{game.current?.setBgStyle(props.save.bgStyle);},[props.save.bgStyle]);
  useEffect(()=>{game.current?.setBulkScale(props.save.bulkPref);},[props.save.bulkPref]);
  useEffect(()=>{sfx.setMuted(phase==="pause"||phase==="over"||props.muted);},[props.muted,phase]);
  const point=(x:number,y:number)=>{const g=game.current;if(g&&phaseRef.current==="play"){g.mouse.active=true;g.mouse.x=x;g.mouse.y=y;}};
  return <main className="game-screen">
    <canvas className="game-canvas" ref={cv} aria-label="Dunia Fish.io. Gerakkan mouse atau WASD untuk berenang." onContextMenu={e=>e.preventDefault()} onPointerMove={e=>point(e.clientX,e.clientY)} onPointerDown={e=>{if(phase!=="play")return;point(e.clientX,e.clientY);e.currentTarget.setPointerCapture(e.pointerId);if(e.button===2)game.current?.setBoost(true);else if(e.pointerType!=="touch")game.current?.setSuck(true);}}/>
    {phase==="loading"&&<div className="game-loading"><div className="loading-art"/><div className="loading-content"><Brand/><Eyebrow>EKSPEDISI BAWAH LAUT</Eyebrow><h1>Menyiapkan lautan<span>.</span></h1><p>{pct<50?"Membentuk ngarai dan terumbu karang...":pct<89?"Menumbuhkan kelp dan mengisi kawanan ikan...":"Menyiapkan penghuni laut..."}</p><div className="load-progress"><i style={{width:`${Math.max(2,pct)}%`}}/></div><span className="load-percent">{pct}%</span><button className="back-link" onClick={exit}><ArrowLeft size={14}/>Kembali ke lobi</button></div></div>}
    {phase==="error"&&<Dialog title="Lautan belum bisa dibuka" eyebrow="KONEKSI RENDERER" onClose={exit}><p className="dialog-intro">Peramban tidak berhasil menyiapkan kanvas permainan. Coba matikan dunia 3D melalui pengaturan, lalu mulai kembali.</p><button className="primary-button full" onClick={exit}>Kembali ke lobi</button></Dialog>}
    {(phase==="play"||phase==="pause")&&hud&&<>
      <div className="game-top"><div className="hud-brand"><Brand compact/><span className="game-top-rule"/><span className="hud-zone"><i/>{hud.zoneName}</span></div><div className="hud-controls"><span className="hud-coin"><Coin size={18}/>{format(hud.coins)}</span><button className="hud-bg-btn" aria-label="Ganti besaran bulk menelan" title="Ubah besaran bulk menelan (1.0x / 1.7x Default / 2.0x)" onClick={()=>props.onSetBulkPref(props.save.bulkPref<1.35?1.7:props.save.bulkPref<1.85?2.0:1.0)}><Gauge size={14}/><span>Bulk: {props.save.bulkPref.toFixed(1)}x</span></button><button className="hud-bg-btn" aria-label="Ganti latar dan warna air" title="Ganti latar & warna air" onClick={()=>{const o=["game2","reef_g1","shipwreck","kelp","temple","lagoon","game1"] as const;props.onSetBgStyle(o[(o.indexOf(props.save.bgStyle)+1)%o.length]);}}><Waves size={14}/><span>{props.save.bgStyle==="game1"?"Air: Game 1":props.save.bgStyle==="reef_g1"?"Reef + Air G1":props.save.bgStyle==="shipwreck"?"⚓ Kapal Karam":props.save.bgStyle==="kelp"?"🌿 Hutan Kelp":props.save.bgStyle==="temple"?"🏛️ Kuil Karang":props.save.bgStyle==="lagoon"?"✨ Laguna Gua":"Air: Reef"}</span></button><button aria-label={props.muted?"Aktifkan suara":"Matikan suara"} onClick={props.onMute}>{props.muted?<VolumeX size={17}/>:<Volume2 size={17}/>}</button><button aria-label="Jeda permainan" onClick={pause}><Pause size={17}/></button></div></div>
      <div className="score-hud"><small>SKOR</small><strong>{format(hud.score)}</strong><span>Level {hud.stageNum} <i/> {hud.mass} massa</span><div className="progress-track"><i style={{width:`${Math.max(3,hud.growthPct>1?hud.growthPct:hud.growthPct*100)}%`}}/></div></div>
      <div className="rank-hud"><button className="rank-toggle" onClick={()=>setBoard(!board)} aria-expanded={board}><Trophy size={15}/><span>Peringkat <b>#{hud.rank||hud.total}</b></span><ChevronDown size={14} className={board?"rotated":""}/></button>{board&&<div className="leaderboard"><small>RANTAI MAKANAN</small>{hud.leaderboard.map((r,i)=><div className={r.me?"me":""} key={`${i}-${r.name}`}><span>{String(i+1).padStart(2,"0")}</span><b>{r.name}</b><strong>{format(r.score)}</strong></div>)}<p>{hud.total} penghuni bersaing</p></div>}</div>
      {hud.combo>1&&<div className="combo-hud">{hud.combo}x <span>KOMBO</span></div>}
      {hud.jellyStun>0 ? <div className="sting-status" role="status" aria-label="Tersengat ubur-ubur. Berenang terganggu selama empat detik."><Zap size={17}/><span><strong>Tersengat ubur-ubur</strong><small>Pusing &middot; Turbo pulih setelah efek berakhir</small><i><b style={{width:`${hud.jellyStun/4*100}%`}}/></i></span><em>{hud.jellyStun.toFixed(1)} dtk</em></div> : message&&<div className="game-message" role="status"><Compass size={15}/>{message}</div>}
      <div className="game-bottom"><div className="map-slot">{showMap&&<canvas ref={minimap} width="180" height="114" className="minimap" aria-label="Peta posisi pemain dan terumbu"/>}<button onClick={()=>setShowMap(!showMap)} aria-expanded={showMap}><Map size={15}/>{showMap?"Tutup peta":"Peta laut"}<kbd>M</kbd></button></div>
        <div className="energy-hud"><div><Waves size={14}/><span>Sedotan</span><i><b style={{width:`${hud.energy*100}%`}}/></i><kbd>Spasi</kbd></div><div><Zap size={14}/><span>Turbo</span><i><b style={{width:`${hud.boost*100}%`}}/></i><kbd>Shift</kbd></div></div>
        <div className="touch-actions"><button aria-label="Tahan untuk menyedot" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);game.current?.setSuck(true);}} onPointerUp={()=>game.current?.setSuck(false)}><Waves size={23}/></button><button aria-label="Tahan untuk melaju" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);game.current?.setBoost(true);}} onPointerUp={()=>game.current?.setBoost(false)}><Zap size={23}/></button></div>
      </div>
      {(hud.shieldT>0||hud.turboT>0||hud.vortexT>0)&&<div className="powerup-hud"><Shield size={14}/>{hud.shieldT>0?"Perisai":hud.turboT>0?"Turbo":"Pusaran"} aktif</div>}
    </>}
    {phase==="pause"&&<Dialog title="Jeda menyelam" eyebrow="EKSPEDISI DIJEDA" onClose={resume}><div className="pause-fish"><FishPortrait skin={skin}/></div><div className="pause-ident"><strong>{skin.name}</strong><span>{props.save.name||"Kamu"} &middot; {lightMode?"Mode adaptif":"Dunia laut 3D"}</span></div><div className="result-stats"><div><small>Skor saat ini</small><b>{format(hud?.score||0)}</b></div><div><small>Koin sesi</small><b><Coin size={18}/>{hud?.coins||0}</b></div><div><small>Peringkat</small><b>#{hud?.rank||50}</b></div></div><div className="pause-bg-switch"><span className="field-label">Besaran bulk menelan</span><div className="segmented" role="group" aria-label="Pilih besaran bulk menelan"><button type="button" className={Math.abs(props.save.bulkPref-1.0)<0.05?"active":""} onClick={()=>props.onSetBulkPref(1.0)}>1.0x</button><button type="button" className={Math.abs(props.save.bulkPref-1.7)<0.05?"active":""} onClick={()=>props.onSetBulkPref(1.7)}>1.7x (Default)</button><button type="button" className={Math.abs(props.save.bulkPref-2.0)<0.05?"active":""} onClick={()=>props.onSetBulkPref(2.0)}>2.0x</button></div></div><div className="pause-bg-switch"><span className="field-label">Latar & warna air</span><div className="segmented" role="group" aria-label="Pilih gaya latar dan warna air"><button type="button" className={props.save.bgStyle==="game2"?"active":""} onClick={()=>props.onSetBgStyle("game2")}>Tropical Reef</button><button type="button" className={props.save.bgStyle==="reef_g1"?"active":""} onClick={()=>props.onSetBgStyle("reef_g1")}>Reef + Air G1</button><button type="button" className={props.save.bgStyle==="game1"?"active":""} onClick={()=>props.onSetBgStyle("game1")}>Laut Biru G1</button><button type="button" className={props.save.bgStyle==="shipwreck"?"active":""} onClick={()=>props.onSetBgStyle("shipwreck")}>⚓ Kapal Karam</button><button type="button" className={props.save.bgStyle==="kelp"?"active":""} onClick={()=>props.onSetBgStyle("kelp")}>🌿 Hutan Kelp</button><button type="button" className={props.save.bgStyle==="temple"?"active":""} onClick={()=>props.onSetBgStyle("temple")}>🏛️ Kuil Karang</button><button type="button" className={props.save.bgStyle==="lagoon"?"active":""} onClick={()=>props.onSetBgStyle("lagoon")}>✨ Laguna Gua</button></div></div><button className="primary-button full" onClick={resume}><Play size={16} fill="currentColor"/>Lanjutkan bermain</button><button className="secondary-button full" onClick={exit}><ArrowLeft size={15}/>Simpan & kembali ke lobi</button></Dialog>}
    {phase==="over"&&death&&<Dialog title="Ekspedisi selesai" eyebrow="CATATAN PERJALANAN" onClose={exit}><p className="dialog-intro">{death.killer?`Perjalananmu terhenti oleh ${death.killer}.`:"Perjalanan bawah lautmu berakhir."} Lautan menanti percobaan berikutnya.</p><div className="end-score"><Trophy size={22}/><small>SKOR AKHIR</small><b>{format(death.score)}</b></div><div className="result-stats"><div><small>Ikan dimakan</small><b>{death.eaten}</b></div><div><small>Koin didapat</small><b><Coin size={17}/>{death.coins}</b></div><div><small>Kombo</small><b>{death.maxCombo}x</b></div></div><div className="run-detail"><span><Gauge size={15}/>Kedalaman</span><strong>{format(death.maxDepth)} m</strong></div><div className="run-detail"><span><Flag size={15}/>Peringkat terbaik</span><strong>#{death.bestRank}</strong></div><button className="primary-button full" onClick={begin}><RotateCcw size={16}/>Berenang lagi</button><button className="secondary-button full" onClick={exit}><ArrowLeft size={15}/>Kembali ke lobi</button><p className="saved-result"><Check size={13}/>Hasil ekspedisi tersimpan</p></Dialog>}
  </main>;
}