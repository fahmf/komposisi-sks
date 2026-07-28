import { DarkGradientBg } from '@/components/ui/elegant-dark-pattern';

/** Standalone showcase of the pattern surface. */
export default function Home() {
  return (
    <DarkGradientBg>
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-6 p-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Komposisi SKS</h1>
          <p className="max-w-md text-lg text-slate-600 dark:text-gray-300">
            Pembagian SKS pengajar tiap semester — tersusun otomatis, tetap bisa Anda sesuaikan.
          </p>
        </div>
      </div>
    </DarkGradientBg>
  );
}
