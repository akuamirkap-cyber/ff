import { useState } from 'react';
import { ArrowLeft, Gamepad2, Play, RotateCcw, Waves } from 'lucide-react';

type GameId = 'submarine' | 'reef';

interface GameEntry {
  id: GameId;
  code: string;
  title: string;
  subtitle: string;
  src: string;
  image: string;
  imageAlt: string;
  description: string;
  highlights: string[];
  controls: string;
}

const GAMES: GameEntry[] = [
  {
    id: 'submarine',
    code: 'Game 01 · Submarine & Diver Mechanics',
    title: 'Fish.io — Submarine & Diver',
    subtitle: 'Mode Dunia Laut 3D Tampak Samping',
    src: '/games/submarine/index.html',
    image: '/images/coral-garden-menu.jpg',
    imageAlt: 'Kapal selam dan terumbu karang di Fish.io Submarine & Diver Mechanics',
    description:
      'Versi feeding frenzy dengan pembaruan mekanik kapal selam, penyelam, sinar matahari bawah laut, serta terumbu karang 3D Abyssal Garden.',
    highlights: [
      'Mekanik kapal selam & penyelam yang diperbarui',
      'Mode 3D tampak samping, upgrade kecepatan & magnet',
      'Koleksi skin ikan lengkap & sistem piala lokal',
    ],
    controls: 'Mouse / sentuh untuk berenang · Klik / Space untuk dash',
  },
  {
    id: 'reef',
    code: 'Game 02 · Enhanced 3D Ocean',
    title: 'Fish.io — Tropical Reef 3D',
    subtitle: 'Edisi Teras Karang & Atlas Laut',
    src: '/games/reef/index.html',
    image: '/images/sunlit-terraces.webp',
    imageAlt: 'Teras karang dan kapal selam Jules Verne di Fish.io Tropical Reef',
    description:
      'Edisi dunia laut 3D yang disempurnakan dengan lobi interaktif, Atlas Laut 3D, awak penyelam Mark V, dan terumbu karang berlapis.',
    highlights: [
      'Observatorium Atlas Laut 3D dengan kamera interaktif',
      'Kapal selam Jules Verne, penyelam Mark V, dan ubur-ubur',
      'Ensiklopedia Koleksi Ikan, Peningkatan & Pencapaian',
    ],
    controls: 'Arahkan kursor / jari untuk berenang · Shift / Klik untuk sprint',
  },
];

export default function App() {
  const [activeId, setActiveId] = useState<GameId | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const activeGame = GAMES.find((g) => g.id === activeId) ?? null;

  const launchGame = (id: GameId) => {
    setActiveId(id);
    setReloadNonce((n) => n + 1);
  };

  if (activeGame) {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#06131A] text-[#ECFDF5]">
        <header className="h-13 shrink-0 px-4 md:px-6 border-b border-white/10 bg-[#081922] flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setActiveId(null)}
            className="inline-flex items-center gap-2 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-[#CBE7E2] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Pilih Game</span>
          </button>

          <nav
            aria-label="Ganti game aktif"
            className="flex items-center gap-1 p-1 bg-[#040E14] border border-white/10 rounded-lg overflow-x-auto max-w-full"
          >
            {GAMES.map((game) => {
              const isSelected = game.id === activeGame.id;
              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => {
                    if (!isSelected) launchGame(game.id);
                  }}
                  aria-current={isSelected ? 'page' : undefined}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4] ${
                    isSelected
                      ? 'bg-[#5EEAD4] text-[#052026]'
                      : 'text-[#9FB8BD] hover:text-white hover:bg-white/5'
                  }`}
                >
                  {game.id === 'submarine' ? '1. Submarine & Diver' : '2. Tropical Reef 3D'}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            title="Muat ulang game ini"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-[#CBE7E2] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4]"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Muat Ulang</span>
          </button>
        </header>

        <main className="flex-1 w-full relative bg-[#06131A]">
          <iframe
            key={`${activeGame.id}-${reloadNonce}`}
            src={activeGame.src}
            title={activeGame.title}
            className="w-full h-full border-0 block bg-[#06131A]"
            allow="autoplay; fullscreen"
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#06131A] text-[#ECFDF5] flex flex-col">
      <header className="w-full border-b border-white/10 bg-[#07161E]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <Waves className="w-5 h-5 text-[#5EEAD4]" aria-hidden="true" />
            <span
              className="text-lg font-bold tracking-tight text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Fish.io Arcade
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-[#94B0B6] whitespace-nowrap shrink-0">
            <span>2 Game Laut 3D Siap Dimainkan</span>
            <span aria-hidden="true">·</span>
            <span>Progres Tersimpan Terpisah</span>
          </div>

          <button
            type="button"
            onClick={() => launchGame('reef')}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg bg-[#5EEAD4] text-[#052026] hover:bg-[#99F6E4] transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4]"
          >
            <Gamepad2 className="w-4 h-4" aria-hidden="true" />
            <span>Mulai Cepat</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-10 md:py-14 flex flex-col justify-center">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-semibold tracking-wider text-[#5EEAD4] mb-2">
            Pilihan Game Laut 3D
          </p>
          <h1
            className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight"
            style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
          >
            Pilih edisi game yang ingin kamu mainkan
          </h1>
          <p className="mt-3 text-sm md:text-base text-[#9FB8BD] leading-relaxed">
            Kedua arsip game berjalan utuh dengan aset dan penyimpanannya masing-masing. Kamu bisa
            berpindah antar game kapan saja dari bilah atas.
          </p>
        </div>

        <section
          aria-label="Daftar game yang tersedia"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"
        >
          {GAMES.map((game) => {
            const hasImgError = !!imgErrors[game.id];
            return (
              <article
                key={game.id}
                className="flex flex-col bg-[#0B202A] border border-white/10 rounded-xl overflow-hidden transition-colors duration-150 hover:border-[#5EEAD4]/40"
              >
                <div className="relative aspect-video w-full bg-[#091A22] overflow-hidden border-b border-white/10">
                  {hasImgError ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#0F2F3D] to-[#07161E] text-[#5EEAD4]">
                      <Waves className="w-8 h-8" aria-hidden="true" />
                      <span className="text-sm font-semibold text-white">{game.title}</span>
                    </div>
                  ) : (
                    <img
                      src={game.image}
                      alt={game.imageAlt}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setImgErrors((prev) => ({
                          ...prev,
                          [game.id]: true,
                        }))
                      }
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between gap-6">
                  <div>
                    <div className="text-xs font-medium text-[#7AA1A8] mb-2">{game.code}</div>
                    <h2
                      className="text-xl md:text-2xl font-bold text-white tracking-tight"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {game.title}
                    </h2>
                    <p className="mt-2 text-sm text-[#A9C2C7] leading-relaxed">
                      {game.description}
                    </p>

                    <ul className="mt-5 pt-4 border-t border-white/10 space-y-2 text-xs md:text-sm text-[#D1E8E4]">
                      {game.highlights.map((item) => (
                        <li key={item} className="flex items-start gap-2.5">
                          <span
                            className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#5EEAD4] shrink-0"
                            aria-hidden="true"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <span className="text-xs text-[#89A5AB]">{game.controls}</span>
                    <button
                      type="button"
                      onClick={() => launchGame(game.id)}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] text-sm font-semibold rounded-lg bg-[#5EEAD4] text-[#052026] hover:bg-[#99F6E4] transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4]"
                    >
                      <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                      <span>Mainkan</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <footer className="w-full border-t border-white/10 bg-[#07161E]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#7E9BA1]">
          <span>Fish.io Dual Ocean Arcade</span>
          <span>Submarine &amp; Diver · Tropical Reef 3D</span>
        </div>
      </footer>
    </div>
  );
}
