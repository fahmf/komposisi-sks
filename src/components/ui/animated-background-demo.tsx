import AuroraBackground from '@/components/ui/animated-background';

/** Standalone showcase of the full-strength aurora surface. */
export default function AuroraDemo() {
  return (
    <AuroraBackground>
      <div className="flex min-h-screen flex-col items-center justify-center px-8 text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
          Komposisi SKS
        </h1>
        <p className="mb-8 max-w-md text-lg text-slate-600 dark:text-slate-300">
          Pembagian SKS pengajar tiap semester — tersusun otomatis, tetap bisa Anda sesuaikan.
        </p>
        <button className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-slate-900 backdrop-blur-sm transition-all duration-300 hover:bg-white/20 dark:text-white">
          Mulai
        </button>
      </div>
    </AuroraBackground>
  );
}
