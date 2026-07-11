import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Package, AlertTriangle, ArrowRightLeft, 
  Calendar, MapPin, Activity, PieChart as PieChartIcon, BarChart3
} from 'lucide-react';
import { Transaction, InventoryItem, LocationData, Language } from '../../types';
import { 
  getKPIs, getConsumptionTrend, getTransferVolumes, 
  getCategoryDistribution, getTopDepletingItems 
} from '../../utils/analytics';

interface AnalyticsDashboardProps {
  transactions: Transaction[];
  inventory: Record<string, InventoryItem[]>;
  availableLocations: LocationData[];
  language: Language;
  t: any;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  transactions,
  inventory,
  availableLocations,
  language,
  t
}) => {
  const [timeframe, setTimeframe] = useState<number>(30); // 7, 30, 365, 0 (all time)

  const { kpis, consumption, transfers, categories, topItems } = useMemo(() => {
    return {
      kpis: getKPIs(inventory, transactions, timeframe, availableLocations),
      consumption: getConsumptionTrend(transactions, timeframe),
      transfers: getTransferVolumes(transactions, timeframe, availableLocations, language),
      categories: getCategoryDistribution(inventory),
      topItems: getTopDepletingItems(transactions, timeframe, language)
    };
  }, [transactions, inventory, timeframe, availableLocations, language]);

  return (
    <div className={`animate-in fade-in slide-in-from-bottom-2 duration-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            {t.analyticsDashboard || 'Analytics Dashboard'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t.analyticsDesc || 'Advanced insights and historical trends'}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          {[
            { value: 7, label: t.last7Days || '7 Days' },
            { value: 30, label: t.last30Days || '30 Days' },
            { value: 365, label: t.ytd || 'YTD' },
            { value: 0, label: t.allTime || 'All Time' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimeframe(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeframe === opt.value 
                  ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.totalStock || 'Total Stock Items'}</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{kpis.totalItems.toLocaleString()}</h3>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.lowStockAlerts || 'Low Stock Alerts'}</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{kpis.lowStock}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.activeTransfers || 'Active Transfers'}</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{kpis.activeTransfers}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.mostActiveBranch || 'Most Active Branch'}</p>
            <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1 truncate">{kpis.mostActiveBranchName}</h3>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Consumption Trend */}
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-brand-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.historicalConsumption || 'Historical Consumption'}</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={consumption.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {consumption.branchIds.map((loc, idx) => (
                    <linearGradient key={loc} id={`color${loc}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                <RechartsTooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, #fff)'}}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                {consumption.branchIds.map((loc, idx) => {
                  const locData = availableLocations.find(l => l.id === loc);
                  const name = locData ? (language === 'ar' ? (locData.nameAr || locData.name) : locData.name) : loc;
                  return (
                    <Area 
                      key={loc} 
                      type="monotone" 
                      dataKey={loc} 
                      name={name} 
                      stroke={COLORS[idx % COLORS.length]} 
                      fillOpacity={1} 
                      fill={`url(#color${loc})`} 
                      strokeWidth={3}
                    />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transfer Volumes */}
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.transferVolumes || 'Transfer Volumes (From Warehouse)'}</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transfers} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600, fill: '#6b7280'}} width={100} />
                <RechartsTooltip 
                  cursor={{fill: 'rgba(0,0,0,0.05)'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="quantity" name={t.quantity || 'Quantity'} radius={[0, 8, 8, 0]}>
                  {transfers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Category Distribution */}
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.categoryDistribution || 'Category Distribution'}</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Depleting Items */}
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.topDepletingItems || 'Top Depleting Items'}</h3>
          </div>
          <div className="space-y-4">
            {topItems.length === 0 ? (
              <div className="text-center text-gray-400 py-10 text-sm">
                {t.noDataAvailable || 'No usage data available for this period'}
              </div>
            ) : (
              topItems.map((item, idx) => {
                const maxVal = topItems[0].quantity;
                const percent = Math.max(5, (item.quantity / maxVal) * 100);
                return (
                  <div key={idx} className="flex items-center gap-4">
                    <span className="w-6 text-center font-bold text-gray-400">#{idx + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white">{item.name}</span>
                        <span className="font-bold text-brand-600 dark:text-brand-400">{item.quantity}</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
