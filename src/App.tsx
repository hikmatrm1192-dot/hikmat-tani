/**
 * HIKMAT TANI - Agriculture Engine & Foundation Status & Verification App
 * 
 * Memvalidasi fondasi IndexedDB Dexie dan Mesin Logika Pertanian (Core Agriculture Engine)
 * yang berjalan 100% offline di browser tanpa ketergantungan API eksternal.
 */

import { useEffect, useState } from 'react';
import { EngineTestResult, runEngineTests } from '../tests/engine.test.ts';
import { runDatabaseTests, TestResult } from '../tests/index.test.ts';
import { db, initializeDatabase, knowledgeRepository } from './db/index.ts';
import {
  buildActivityTimeline,
  buildFieldContext,
  calculateHST,
  calculateNutrients,
  determineGrowthPhase,
  evaluateRecommendations,
} from './engine/index.ts';

export default function App() {
  const [initStatus, setInitStatus] = useState<string>('Memulai inisialisasi...');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [counts, setCounts] = useState<{
    fertilizers: number;
    opts: number;
    varieties: number;
    articles: number;
    references: number;
  }>({ fertilizers: 0, opts: 0, varieties: 0, articles: 0, references: 0 });
  const [dbTestResults, setDbTestResults] = useState<TestResult[]>([]);
  const [engineTestResults, setEngineTestResults] = useState<EngineTestResult[]>([]);
  const [testingRunning, setTestingRunning] = useState<boolean>(false);

  // Live Simulation Demo State
  const [demoHst, setDemoHst] = useState<number>(25);
  const [demoDuration, setDemoDuration] = useState<number>(120);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    async function init() {
      try {
        const res = await initializeDatabase();
        setInitStatus(
          `Database Dexie Terbuka (Versi: ${db.verno}) • Storage Terproteksi: ${
            res.isPersisted ? 'Ya' : 'Standar Browser'
          }`
        );

        // Ambil hitungan master data awal
        const ferts = await knowledgeRepository.getAllFertilizers();
        const opts = await knowledgeRepository.getAllOpts();
        const varieties = await knowledgeRepository.getAllVarieties();
        const articles = await knowledgeRepository.getAllArticles();
        const references = await knowledgeRepository.getAllReferences();

        setCounts({
          fertilizers: ferts.length,
          opts: opts.length,
          varieties: varieties.length,
          articles: articles.length,
          references: references.length,
        });

        // Jalankan pengujian database & engine otomatis
        const dbTests = await runDatabaseTests();
        setDbTestResults(dbTests.results);

        const engTests = await runEngineTests();
        setEngineTestResults(engTests.results);
      } catch (err: any) {
        setInitStatus(`Gagal inisialisasi: ${err?.message || err}`);
      }
    }

    init();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRunAllTests = async () => {
    setTestingRunning(true);
    const dbTests = await runDatabaseTests();
    setDbTestResults(dbTests.results);

    const engTests = await runEngineTests();
    setEngineTestResults(engTests.results);
    setTestingRunning(false);
  };

  // Live evaluation based on demo inputs
  const livePhase = determineGrowthPhase(demoHst, demoDuration);
  const sampleContext = buildFieldContext({
    cropSeason: {
      id: 'demo-season-1',
      landId: 'land-demo',
      commodity: 'Padi',
      varietyName: 'Inpari 32 HDB',
      plantingDate: '2026-08-01T00:00:00.000Z',
      plantedAreaHa: 0.8,
      plantingSystem: 'JAJAR_LEGOWO_2_1',
      status: 'ACTIVE',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    targetDate: new Date(new Date('2026-08-01').getTime() + demoHst * 86400000),
    varietyDurationDays: demoDuration,
  });
  const liveRecommendations = evaluateRecommendations(sampleContext);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Fondasi */}
        <header className="pb-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-emerald-800 tracking-tight">
                HIKMAT TANI
              </h1>
              <p className="text-sm text-slate-500">
                Core Agriculture Engine & Offline Verification (Langkah 4)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isOnline
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {isOnline ? 'Online (Terhubung)' : 'Offline (Mandiri)'}
              </span>
            </div>
          </div>
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-mono text-emerald-900">
            {initStatus}
          </div>
        </header>

        {/* Ringkasan Data Awal */}
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs text-center">
            <span className="text-xs text-slate-500 block">Master Pupuk</span>
            <span className="text-lg font-bold text-slate-800">{counts.fertilizers}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs text-center">
            <span className="text-xs text-slate-500 block">Master OPT</span>
            <span className="text-lg font-bold text-slate-800">{counts.opts}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs text-center">
            <span className="text-xs text-slate-500 block">Varietas Padi</span>
            <span className="text-lg font-bold text-slate-800">{counts.varieties}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs text-center">
            <span className="text-xs text-slate-500 block">Artikel Ilmu</span>
            <span className="text-lg font-bold text-slate-800">{counts.articles}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs text-center col-span-2 sm:col-span-1">
            <span className="text-xs text-slate-500 block">Referensi Ilmiah</span>
            <span className="text-lg font-bold text-slate-800">{counts.references}</span>
          </div>
        </section>

        {/* Live Agriculture Engine Demonstration */}
        <section className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Verifikasi Live Engine Logika Pertanian (Pure Logic)
              </h2>
              <p className="text-xs text-slate-500">
                Simulasi kalkulasi HST, pemetaan fase fenologi, dan pembentukan saran santun.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-slate-600">
                HST:{' '}
                <input
                  type="number"
                  min="0"
                  max="150"
                  value={demoHst}
                  onChange={(e) => setDemoHst(Number(e.target.value))}
                  className="w-16 px-2 py-1 border border-slate-300 rounded text-xs ml-1"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Umur Varietas:{' '}
                <input
                  type="number"
                  min="80"
                  max="160"
                  value={demoDuration}
                  onChange={(e) => setDemoDuration(Number(e.target.value))}
                  className="w-16 px-2 py-1 border border-slate-300 rounded text-xs ml-1"
                />{' '}
                hari
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-200/70 text-xs space-y-2">
              <span className="font-bold text-emerald-900 block text-sm">
                Fase Fenologi: {livePhase.label}
              </span>
              <p className="text-slate-700">{livePhase.description}</p>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-emerald-200/50 flex justify-between">
                <span>Kategori: {livePhase.stageCategory}</span>
                <span>Rasio: {((demoHst / demoDuration) * 100).toFixed(1)}% umur</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-slate-800 block text-sm">
                Saran Sistem yang Dihasilkan (Recommendation Engine)
              </span>
              {liveRecommendations.length > 0 ? (
                liveRecommendations.map((r, i) => (
                  <div key={i} className="p-2 bg-white rounded border border-slate-200/70">
                    <span className="font-semibold text-slate-800 block">{r.title}</span>
                    <p className="text-slate-600 mt-0.5">{r.message}</p>
                    <span className="block text-[10px] text-emerald-700 font-mono mt-1">
                      Rujukan: {r.referenceIds.join(', ')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">Tidak ada saran aktif pada kondisi ini.</p>
              )}
            </div>
          </div>
        </section>

        {/* Panel Hasil Uji Agriculture Logic Engine (Langkah 4) */}
        <section className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Uji Unit & Penerimaan Core Agriculture Engine (Langkah 4)
              </h2>
              <p className="text-xs text-slate-500">
                HST Engine, Growth Phase, Nutrient Calculation, Unit Conversion, Timeline, Context, & Recommendation Rules.
              </p>
            </div>
            <button
              onClick={handleRunAllTests}
              disabled={testingRunning}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {testingRunning ? 'Menguji...' : 'Uji Ulang Semua'}
            </button>
          </div>

          <div className="space-y-2">
            {engineTestResults.map((t, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border text-xs flex items-start justify-between ${
                  t.passed
                    ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50/50 border-rose-200 text-rose-900'
                }`}
              >
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    {t.suite}
                  </span>
                  <span className="font-semibold text-slate-800">{t.name}</span>
                  <span className="text-slate-600 text-[11px] block mt-0.5">{t.message}</span>
                </div>
                <span
                  className={`inline-block font-bold text-[10px] px-2 py-0.5 rounded shrink-0 ml-4 ${
                    t.passed
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-rose-200 text-rose-900'
                  }`}
                >
                  {t.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Panel Hasil Uji Fondasi Database (Langkah 3) */}
        <section className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-xs">
          <h2 className="text-base font-bold text-slate-800 mb-1">
            Uji Penerimaan Fondasi Database & Transaksi Atomik (Langkah 3)
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Integritas Dexie IndexedDB, skema 3-lapisan keputusan, dan operasi outbox.
          </p>
          <div className="space-y-2">
            {dbTestResults.map((t, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border text-xs flex items-start justify-between ${
                  t.passed
                    ? 'bg-slate-50 border-slate-200 text-slate-800'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div>
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-slate-500 text-[11px] block">{t.message}</span>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span
                    className={`inline-block font-bold text-[10px] px-2 py-0.5 rounded ${
                      t.passed
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {t.passed ? 'PASSED' : 'FAILED'}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    {t.durationMs} ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer Minimalis */}
        <footer className="pt-2 text-center text-xs text-slate-400">
          HIKMAT TANI • Fondasi Arsitektur Bersih & Berorientasi Petani
        </footer>
      </div>
    </div>
  );
}
