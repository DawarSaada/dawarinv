import React from 'react';
import { 
  Calendar, 
  Warehouse, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  FileText, 
  FileSpreadsheet 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Transaction, LocationData, Language } from '../../types';

interface AdminReportsProps {
  transactions: Transaction[];
  availableLocations: LocationData[];
  reportDate: string;
  setReportDate: (date: string) => void;
  reportLocation: string;
  setReportLocation: (loc: string) => void;
  reportFilter: 'all' | 'received' | 'used';
  setReportFilter: (filter: 'all' | 'received' | 'used') => void;
  t: any;
  language: Language;
  onExportPDF: () => void;
  onExportExcel: () => void;
  // Chart Data
  txByDayData: any[];
  catDistributionData: any[];
  topUsedItems: any[];
  COLORS: string[];
}

const AdminReports: React.FC<AdminReportsProps> = ({
  transactions,
  availableLocations,
  reportDate,
  setReportDate,
  reportLocation,
  setReportLocation,
  reportFilter,
  setReportFilter,
  t,
  language,
  onExportPDF,
  onExportExcel,
  txByDayData,
  catDistributionData,
  topUsedItems,
  COLORS
}) => {
  // Filter transactions for specific report listing
  const filteredReportTx = transactions.filter(tx => {
      const txDate = new Date(tx.date).toISOString().split('T')[0];
      const isDateMatch = txDate === reportDate;
      const isLocMatch = reportLocation === 'all' || tx.fromLocation === reportLocation || tx.toLocation === reportLocation;
      const isTypeMatch = reportFilter === 'all' || 
          (reportFilter === 'received' && (tx.type === 'receive' || (tx.type === 'transfer' && tx.toLocation === reportLocation))) ||
          (reportFilter === 'used' && (tx.type === 'usage' || (tx.type === 'transfer' && tx.fromLocation === reportLocation)));
      
      return isDateMatch && isLocMatch && isTypeMatch;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t.reports}</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t.dailyPerformanceDesc}</p>
        </div>
      </div>

      {/* Report Controls */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Calendar className="w-3 h-3" /> {t.date}</label>
                  <input 
                      type="date" 
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
              </div>
              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Warehouse className="w-3 h-3" /> {t.location}</label>
                  <select 
                      value={reportLocation}
                      onChange={(e) => setReportLocation(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                      {availableLocations.map(loc => (
                          <option key={loc.id} value={loc.id === 'warehouse' ? 'المركز الرئيسي' : loc.id === 'mammal' ? 'قسم الثدييات' : loc.name}>
                              {loc.id === 'warehouse' ? t.warehouse : loc.id === 'mammal' ? t.mammal : (language === 'ar' ? (loc.nameAr || loc.name) : loc.name)}
                          </option>
                      ))}
                  </select>
              </div>
              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><ArrowDownCircle className="w-3 h-3" /> {t.filter}</label>
                  <select 
                      value={reportFilter}
                      onChange={(e) => setReportFilter(e.target.value as any)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                      <option value="all">{t.allTypes}</option>
                      <option value="received">{t.received}</option>
                      <option value="used">{t.used}</option>
                  </select>
              </div>
              <div className="flex items-end gap-2">
                  <button onClick={onExportPDF} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all">
                      <FileText className="w-4 h-4" /> PDF
                  </button>
                  <button onClick={onExportExcel} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all">
                      <FileSpreadsheet className="w-4 h-4" /> Excel
                  </button>
              </div>
          </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-brand-600" /> {language === 'ar' ? 'حركة المعاملات آخر 7 أيام' : 'Transaction Trends (Last 7 Days)'}
              </h3>
              <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={txByDayData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                          <Tooltip 
                              contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                              cursor={{fill: '#f3f4f6'}}
                          />
                          <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '12px'}} />
                          <Bar dataKey="Transfers" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                          <Bar dataKey="Usage" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} />
                          <Bar dataKey="Received" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-brand-600" /> {language === 'ar' ? 'توزيع الأصناف حسب الفئة' : 'Category Distribution'}
              </h3>
              <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={catDistributionData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                          >
                              {catDistributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                          </Pie>
                          <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
                          <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '12px'}} />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>

      {/* Top Items Ranking */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm mb-8">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-orange-500" /> {language === 'ar' ? 'أكثر الأصناف استهلاكاً' : 'Top Consumed Items'}
          </h3>
          <div className="space-y-4">
              {topUsedItems.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-4">
                      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-bold text-xs">
                          #{index + 1}
                      </div>
                      <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                              <span className="text-sm font-bold text-gray-900 dark:text-white">{item.quantity} units</span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                              <div 
                                  className="bg-orange-500 h-full rounded-full" 
                                  style={{width: `${(item.quantity / topUsedItems[0].quantity) * 100}%`}}
                              ></div>
                          </div>
                      </div>
                  </div>
              ))}
              {topUsedItems.length === 0 && <p className="text-center text-gray-400 italic py-8">{t.noTransactionsFound}</p>}
          </div>
      </div>

      {/* Daily Report Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.dailyTransactions}</h3>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-xs sm:text-sm">
                  <thead>
                      <tr className="bg-gray-50/30 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700 text-gray-400 font-bold uppercase">
                          <th className="px-6 py-4">{t.time}</th>
                          <th className="px-6 py-4">{t.type}</th>
                          <th className="px-6 py-4">{t.itemName}</th>
                          <th className="px-6 py-4">{t.quantity}</th>
                          <th className="px-6 py-4">{t.status}</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredReportTx.map(tx => (
                          <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4 text-gray-500">{new Date(tx.date).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US')}</td>
                              <td className="px-6 py-4">
                                  <span className={`flex items-center gap-1.5 font-bold ${tx.type === 'transfer' ? 'text-blue-600' : tx.type === 'usage' ? 'text-orange-600' : 'text-green-600'}`}>
                                      {t[tx.type]}
                                  </span>
                              </td>
                              <td className="px-6 py-4 font-medium">{language === 'ar' ? tx.itemNameAr : tx.itemNameEn}</td>
                              <td className="px-6 py-4 font-bold">{tx.quantity} {tx.unit}</td>
                              <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${tx.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                      {t[tx.status]}
                                  </span>
                              </td>
                          </tr>
                      ))}
                      {filteredReportTx.length === 0 && (
                          <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">{t.noTransactionsFound}</td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default AdminReports;
