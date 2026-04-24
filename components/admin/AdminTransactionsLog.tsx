import React from 'react';
import { 
  Search, 
  Filter, 
  ArrowRightLeft, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  CheckCircle, 
  Clock,
  XCircle 
} from 'lucide-react';
import { Transaction, Language } from '../../types';
import { Pagination } from '../Pagination';

interface AdminTransactionsLogProps {
  transactions: Transaction[];
  t: any;
  language: Language;
  search: string;
  setSearch: (val: string) => void;
  typeFilter: 'all' | 'transfer' | 'usage' | 'receive';
  setTypeFilter: (val: 'all' | 'transfer' | 'usage' | 'receive') => void;
  page: number;
  setPage: (val: number) => void;
  pageSize: number;
  setPageSize: (val: number) => void;
  getUserName: (name: string) => string;
}

const AdminTransactionsLog: React.FC<AdminTransactionsLogProps> = ({
  transactions,
  t,
  language,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  page,
  setPage,
  pageSize,
  setPageSize,
  getUserName
}) => {
  const filteredTx = transactions.filter(tx => {
    const matchesSearch = 
      (tx.itemNameEn || '').toLowerCase().includes(search.toLowerCase()) ||
      (tx.itemNameAr || '').toLowerCase().includes(search.toLowerCase()) ||
      (tx.fromLocation || '').toLowerCase().includes(search.toLowerCase()) ||
      (tx.toLocation || '').toLowerCase().includes(search.toLowerCase()) ||
      (tx.performedBy || '').toLowerCase().includes(search.toLowerCase());
    
    const matchesType = typeFilter === 'all' || tx.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredTx.length / pageSize);
  const paginatedTx = filteredTx.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t.viewLogs}</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t.fullHistoryDesc}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          </div>
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="all">{t.allTypes}</option>
              <option value="transfer">{t.transfer}</option>
              <option value="usage">{t.usage}</option>
              <option value="receive">{t.receive}</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50/30 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700 text-gray-400 font-bold uppercase">
                <th className="px-6 py-4">{t.date}</th>
                <th className="px-6 py-4">{t.type}</th>
                <th className="px-6 py-4">{t.itemName}</th>
                <th className="px-6 py-4">{t.quantity}</th>
                <th className="px-6 py-4">{t.from}/{t.to}</th>
                <th className="px-6 py-4">{t.performedBy}</th>
                <th className="px-6 py-4">{t.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {paginatedTx.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{new Date(tx.date).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 font-bold ${tx.type === 'transfer' ? 'text-blue-600' : tx.type === 'usage' ? 'text-orange-600' : 'text-green-600'}`}>
                      {tx.type === 'transfer' ? <ArrowRightLeft className="w-3 h-3" /> : tx.type === 'usage' ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
                      {t[tx.type]}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{language === 'ar' ? tx.itemNameAr : tx.itemNameEn}</td>
                  <td className="px-6 py-4 font-bold">{tx.quantity} {tx.unit}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {tx.type === 'transfer' ? `${tx.fromLocation} → ${tx.toLocation}` : tx.fromLocation || tx.toLocation}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{getUserName(tx.performedBy)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${tx.status === 'completed' ? 'bg-green-100 text-green-700' : (tx.status === 'pending_source' || tx.status === 'pending_target') ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {tx.status === 'completed' ? <CheckCircle className="w-3 h-3" /> : (tx.status === 'pending_source' || tx.status === 'pending_target') ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {t[tx.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {paginatedTx.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">{t.noTransactionsFound}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-gray-700">
            <Pagination 
              currentPage={page}
              totalItems={filteredTx.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              language={language === 'ar' ? 'ar' : 'en'}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTransactionsLog;
