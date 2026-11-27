import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  CreditCard,
  History,
  Calendar,
  Layers,
  BarChart3,
  LineChart as LineChartIcon,
  ArrowUpRight,
  ChevronDown,
  Table as TableIcon,
  CheckCircle2,
} from 'lucide-react';
import { syahriyahService } from '../../lib/syahriyahService';
import { kilatanService } from '../../lib/kilatanService';
import { KILATAN_EVENT_MONTH } from '../../lib/constants/kilatan';
import { formatRupiah } from '../../lib/formatter';

const BULAN_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ags',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const BULAN_FULL = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

interface MonthlyDataPoint {
  bulanIdx: number;
  bulan: string;
  bulanFull: string;
  syahriyahTerkumpul: number;
  syahriyahTarget: number;
  kilatanTerkumpul: number;
  kilatanTarget: number;
  totalTerkumpul: number;
  totalTarget: number;
  kilatanEventName?: string;
}

export const MonthlyCollectionTrends: React.FC = () => {
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const [viewMode, setViewMode] = useState<'semua' | 'syahriyah' | 'kilatan'>('semua');
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [showTableDetail, setShowTableDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [syahriyahMatrix, setSyahriyahMatrix] = useState<any[]>([]);
  const [kilatanMatrix, setKilatanMatrix] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      syahriyahService.getSyahriyahMatrix(selectedYear),
      kilatanService.getKilatanMatrix(selectedYear),
    ])
      .then(([sMatrix, kMatrix]) => {
        if (!isMounted) return;
        setSyahriyahMatrix(sMatrix);
        setKilatanMatrix(kMatrix);
      })
      .catch((err) => {
        console.error('Error loading collection trends:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedYear]);

  // Aggregate monthly collection trends
  const monthlyData: MonthlyDataPoint[] = useMemo(() => {
    const data: MonthlyDataPoint[] = [];

    for (let m = 1; m <= 12; m++) {
      let syahriyahTerkumpul = 0;
      let syahriyahTarget = 0;

      syahriyahMatrix.forEach(({ records }) => {
        const rec = records.find((r: any) => r.bulan === m);
        if (rec) {
          syahriyahTerkumpul += rec.total_dibayar || 0;
          syahriyahTarget += rec.nominal_tagihan || 0;
        }
      });

      let kilatanTerkumpul = 0;
      let kilatanTarget = 0;
      let kilatanEventName: string | undefined = undefined;

      // Find if an event matches this month
      const matchingEvents = Object.entries(KILATAN_EVENT_MONTH).filter(
        ([, monthNum]) => monthNum === m
      );

      if (matchingEvents.length > 0) {
        kilatanEventName = matchingEvents.map(([name]) => name).join(', ');
        kilatanMatrix.forEach(({ records }) => {
          records.forEach((r: any) => {
            if (matchingEvents.some(([name]) => name === r.event)) {
              kilatanTerkumpul += r.total_dibayar || 0;
              kilatanTarget += r.nominal_tagihan || 0;
            }
          });
        });
      }

      data.push({
        bulanIdx: m,
        bulan: BULAN_NAMES[m - 1],
        bulanFull: BULAN_FULL[m - 1],
        syahriyahTerkumpul,
        syahriyahTarget,
        kilatanTerkumpul,
        kilatanTarget,
        totalTerkumpul: syahriyahTerkumpul + kilatanTerkumpul,
        totalTarget: syahriyahTarget + kilatanTarget,
        kilatanEventName,
      });
    }

    return data;
  }, [syahriyahMatrix, kilatanMatrix]);

  // Year summary totals
  const summary = useMemo(() => {
    const totalSyahriyah = monthlyData.reduce((acc, d) => acc + d.syahriyahTerkumpul, 0);
    const targetSyahriyah = monthlyData.reduce((acc, d) => acc + d.syahriyahTarget, 0);

    const totalKilatan = monthlyData.reduce((acc, d) => acc + d.kilatanTerkumpul, 0);
    const targetKilatan = monthlyData.reduce((acc, d) => acc + d.kilatanTarget, 0);

    const grandTotal = totalSyahriyah + totalKilatan;
    const grandTarget = targetSyahriyah + targetKilatan;

    const rate = grandTarget > 0 ? Math.round((grandTotal / grandTarget) * 100) : 0;
    const syahriyahRate = targetSyahriyah > 0 ? Math.round((totalSyahriyah / targetSyahriyah) * 100) : 0;
    const kilatanRate = targetKilatan > 0 ? Math.round((totalKilatan / targetKilatan) * 100) : 0;

    // Highest collection month
    const highestMonth = [...monthlyData].sort((a, b) => b.totalTerkumpul - a.totalTerkumpul)[0];

    return {
      totalSyahriyah,
      targetSyahriyah,
      syahriyahRate,
      totalKilatan,
      targetKilatan,
      kilatanRate,
      grandTotal,
      grandTarget,
      rate,
      highestMonth,
    };
  }, [monthlyData]);

  // Custom Chart Tooltip
  const CustomTrendsTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = monthlyData.find((d) => d.bulan === label);
      return (
        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xl text-xs space-y-2 z-50 min-w-[210px]">
          <div className="border-b border-slate-100 pb-1.5 flex items-center justify-between">
            <span className="font-bold text-[#0F172A]">
              {point?.bulanFull || label} {selectedYear}
            </span>
            {point?.kilatanEventName && (
              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                {point.kilatanEventName}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-slate-600 font-medium">{entry.name}:</span>
                </div>
                <span className="font-bold font-mono text-[#0F172A]">
                  {formatRupiah(entry.value)}
                </span>
              </div>
            ))}
          </div>

          {point && point.totalTarget > 0 && (
            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Capaian Tagihan:</span>
              <span className="font-bold text-[#059669]">
                {Math.round((point.totalTerkumpul / point.totalTarget) * 100)}%
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-[#059669]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight">
                Tren Penerimaan Syahriyah & Kilatan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Visualisasi perbandingan tren penerimaan iuran bulanan dan program kilatan santri
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedYear === y
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {y}
              </button>
            ))}
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('semua')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                viewMode === 'semua'
                  ? 'bg-white text-[#059669] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setViewMode('syahriyah')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                viewMode === 'syahriyah'
                  ? 'bg-white text-[#059669] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Syahriyah
            </button>
            <button
              onClick={() => setViewMode('kilatan')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                viewMode === 'kilatan'
                  ? 'bg-white text-[#059669] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kilatan
            </button>
          </div>

          {/* Chart Style Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setChartType('bar')}
              title="Grafik Batang"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('area')}
              title="Grafik Area / Garis"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                chartType === 'area'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LineChartIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mini Stat Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Syahriyah */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Penerimaan Syahriyah</span>
            <CreditCard className="w-3.5 h-3.5 text-[#059669]" />
          </div>
          <div className="text-base sm:text-lg font-bold text-[#0F172A] font-mono">
            {formatRupiah(summary.totalSyahriyah)}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
            <span>Capaian:</span>
            <span className="font-semibold text-emerald-700">{summary.syahriyahRate}%</span>
          </div>
        </div>

        {/* Total Kilatan */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Penerimaan Kilatan</span>
            <History className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-base sm:text-lg font-bold text-[#0F172A] font-mono">
            {formatRupiah(summary.totalKilatan)}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
            <span>Capaian:</span>
            <span className="font-semibold text-amber-700">{summary.kilatanRate}%</span>
          </div>
        </div>

        {/* Grand Total */}
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
            <span>Total Terkumpul ({selectedYear})</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
          </div>
          <div className="text-base sm:text-lg font-bold text-emerald-900 font-mono">
            {formatRupiah(summary.grandTotal)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            {summary.rate}% dari total tagihan
          </div>
        </div>

        {/* Highest Month */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Penerimaan Tertinggi</span>
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-base sm:text-lg font-bold text-[#0F172A] truncate">
            {summary.highestMonth?.bulanFull || '-'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono font-medium truncate">
            {formatRupiah(summary.highestMonth?.totalTerkumpul || 0)}
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="relative pt-2">
        {isLoading ? (
          <div className="h-72 w-full flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <div className="text-xs text-slate-400 animate-pulse">
              Memuat data tren penerimaan...
            </div>
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart
                  data={monthlyData}
                  margin={{ top: 15, right: 15, left: -5, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="bulan"
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    tickFormatter={(val) => `${val / 1000}k`}
                  />
                  <RechartsTooltip content={<CustomTrendsTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }}
                  />

                  {viewMode === 'semua' && (
                    <>
                      <Bar
                        name="Syahriyah"
                        dataKey="syahriyahTerkumpul"
                        fill="#059669"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                      />
                      <Bar
                        name="Kilatan"
                        dataKey="kilatanTerkumpul"
                        fill="#D97706"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                      />
                    </>
                  )}

                  {viewMode === 'syahriyah' && (
                    <>
                      <Bar
                        name="Terkumpul"
                        dataKey="syahriyahTerkumpul"
                        fill="#059669"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                      <Bar
                        name="Target Tagihan"
                        dataKey="syahriyahTarget"
                        fill="#94A3B8"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                    </>
                  )}

                  {viewMode === 'kilatan' && (
                    <>
                      <Bar
                        name="Terkumpul"
                        dataKey="kilatanTerkumpul"
                        fill="#D97706"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                      <Bar
                        name="Target Tagihan"
                        dataKey="kilatanTarget"
                        fill="#CBD5E1"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                    </>
                  )}
                </BarChart>
              ) : (
                <AreaChart
                  data={monthlyData}
                  margin={{ top: 15, right: 15, left: -5, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSyahriyah" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorKilatan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D97706" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#D97706" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="bulan"
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    tickFormatter={(val) => `${val / 1000}k`}
                  />
                  <RechartsTooltip content={<CustomTrendsTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }}
                  />

                  {viewMode === 'semua' && (
                    <>
                      <Area
                        type="monotone"
                        name="Syahriyah"
                        dataKey="syahriyahTerkumpul"
                        stroke="#059669"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorSyahriyah)"
                      />
                      <Area
                        type="monotone"
                        name="Kilatan"
                        dataKey="kilatanTerkumpul"
                        stroke="#D97706"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorKilatan)"
                      />
                    </>
                  )}

                  {viewMode === 'syahriyah' && (
                    <>
                      <Area
                        type="monotone"
                        name="Syahriyah Terkumpul"
                        dataKey="syahriyahTerkumpul"
                        stroke="#059669"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorSyahriyah)"
                      />
                      <Area
                        type="monotone"
                        name="Target Tagihan"
                        dataKey="syahriyahTarget"
                        stroke="#94A3B8"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        fill="none"
                      />
                    </>
                  )}

                  {viewMode === 'kilatan' && (
                    <>
                      <Area
                        type="monotone"
                        name="Kilatan Terkumpul"
                        dataKey="kilatanTerkumpul"
                        stroke="#D97706"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorKilatan)"
                      />
                      <Area
                        type="monotone"
                        name="Target Tagihan"
                        dataKey="kilatanTarget"
                        stroke="#94A3B8"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        fill="none"
                      />
                    </>
                  )}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Expandable Detailed Table Breakdown */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <button
          type="button"
          onClick={() => setShowTableDetail(!showTableDetail)}
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer py-1"
        >
          <TableIcon className="w-3.5 h-3.5 text-slate-500" />
          <span>{showTableDetail ? 'Sembunyikan Rincian Bulanan' : 'Lihat Rincian Bulanan Angka'}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
              showTableDetail ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Shortcuts to Full Matrices */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/syahriyah')}
            className="inline-flex items-center gap-1 text-[#059669] hover:text-[#047857] font-semibold cursor-pointer"
          >
            <span>Matriks Syahriyah</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={() => navigate('/kilatan')}
            className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
          >
            <span>Matriks Kilatan</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Detailed Table */}
      {showTableDetail && (
        <div className="overflow-x-auto border border-slate-200 rounded-xl mt-3 animate-in fade-in duration-200">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5">Bulan</th>
                <th className="px-3 py-2.5 text-right">Syahriyah</th>
                <th className="px-3 py-2.5 text-right">Kilatan</th>
                <th className="px-3 py-2.5 text-right">Total Terkumpul</th>
                <th className="px-3 py-2.5 text-right">Target</th>
                <th className="px-3 py-2.5 text-right">Capaian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {monthlyData.map((row) => {
                const pct = row.totalTarget > 0 ? Math.round((row.totalTerkumpul / row.totalTarget) * 100) : 0;
                return (
                  <tr key={row.bulanIdx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2 font-sans font-medium text-[#0F172A]">
                      {row.bulanFull}
                      {row.kilatanEventName && (
                        <span className="ml-1.5 text-[10px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded font-sans">
                          {row.kilatanEventName}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-700 font-medium">
                      {formatRupiah(row.syahriyahTerkumpul)}
                    </td>
                    <td className="px-3 py-2 text-right text-amber-700 font-medium">
                      {formatRupiah(row.kilatanTerkumpul)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-[#0F172A]">
                      {formatRupiah(row.totalTerkumpul)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {formatRupiah(row.totalTarget)}
                    </td>
                    <td className="px-3 py-2 text-right font-sans font-semibold">
                      <span
                        className={
                          pct >= 80
                            ? 'text-emerald-700'
                            : pct >= 50
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        }
                      >
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold border-t border-slate-200">
              <tr>
                <td className="px-3 py-2.5 font-sans text-[#0F172A]">Total ({selectedYear})</td>
                <td className="px-3 py-2.5 text-right text-emerald-800 font-mono font-bold">
                  {formatRupiah(summary.totalSyahriyah)}
                </td>
                <td className="px-3 py-2.5 text-right text-amber-800 font-mono font-bold">
                  {formatRupiah(summary.totalKilatan)}
                </td>
                <td className="px-3 py-2.5 text-right text-[#0F172A] font-mono font-bold">
                  {formatRupiah(summary.grandTotal)}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-600 font-mono">
                  {formatRupiah(summary.grandTarget)}
                </td>
                <td className="px-3 py-2.5 text-right text-emerald-700 font-sans font-bold">
                  {summary.rate}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
