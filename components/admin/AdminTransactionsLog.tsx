import React from 'react';
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  CheckCircle,
  Clock,
  History,
  XCircle
} from 'lucide-react';
import { Transaction, Language } from '../../types';
import { Pagination } from '../Pagination';
import {
  Badge,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  Panel,
  Segmented,
  cn,
  type Column
} from '../ui';

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

const TYPE_ICON: Record<string, React.ReactNode> = {
  transfer: <ArrowRightLeft />,
  usage: <ArrowDownCircle />,
  receive: <ArrowUpCircle />
};

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
  const isAr = language === 'ar';
  const locale = isAr ? 'ar-EG' : 'en-US';

  const filteredTx = transactions.filter((tx) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      (tx.itemNameEn || '').toLowerCase().includes(term) ||
      (tx.itemNameAr || '').toLowerCase().includes(term) ||
      (tx.fromLocation || '').toLowerCase().includes(term) ||
      (tx.toLocation || '').toLowerCase().includes(term) ||
      (tx.performedBy || '').toLowerCase().includes(term);

    return matchesSearch && (typeFilter === 'all' || tx.type === typeFilter);
  });

  const paginatedTx = filteredTx.slice((page - 1) * pageSize, page * pageSize);

  const statusBadge = (status: Transaction['status']) => {
    if (status === 'completed') {
      return (
        <Badge tone="success" icon={<CheckCircle />}>
          {t[status]}
        </Badge>
      );
    }
    if (status === 'pending_source' || status === 'pending_target') {
      return (
        <Badge tone="warning" icon={<Clock />}>
          {t[status]}
        </Badge>
      );
    }
    return (
      <Badge tone="danger" icon={<XCircle />}>
        {t[status]}
      </Badge>
    );
  };

  const typeBadge = (type: Transaction['type']) => (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        type === 'transfer'
          ? 'text-info-700 dark:text-info-100'
          : type === 'usage'
            ? 'text-warning-700 dark:text-warning-100'
            : 'text-success-700 dark:text-success-100'
      )}
    >
      <span className="[&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden>
        {TYPE_ICON[type]}
      </span>
      {t[type]}
    </span>
  );

  const columns: Column<Transaction>[] = [
    {
      key: 'date',
      header: t.date,
      width: 'w-40',
      cell: (tx) => (
        <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
          {new Date(tx.date).toLocaleString(locale)}
        </span>
      )
    },
    { key: 'type', header: t.type, cell: (tx) => typeBadge(tx.type) },
    {
      key: 'item',
      header: t.itemName,
      cell: (tx) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {isAr ? tx.itemNameAr || tx.itemNameEn : tx.itemNameEn || tx.itemNameAr}
        </span>
      )
    },
    {
      key: 'quantity',
      header: t.quantity,
      align: 'end',
      cell: (tx) => (
        <span className="tnum font-semibold text-gray-900 dark:text-white">
          {tx.quantity}
          <span className="ms-1 text-2xs font-normal text-gray-400">{tx.unit}</span>
        </span>
      )
    },
    {
      key: 'route',
      header: `${t.from}/${t.to}`,
      hideBelow: 'lg',
      cell: (tx) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {tx.type === 'transfer'
            ? `${tx.fromLocation} → ${tx.toLocation}`
            : tx.fromLocation || tx.toLocation}
        </span>
      )
    },
    {
      key: 'performedBy',
      header: t.performedBy,
      hideBelow: 'md',
      cell: (tx) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {getUserName(tx.performedBy)}
        </span>
      )
    },
    { key: 'status', header: t.status, cell: (tx) => statusBadge(tx.status) }
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        sticky={false}
        title={t.viewLogs}
        subtitle={t.fullHistoryDesc}
        icon={<History />}
        meta={<Badge tone="neutral">{transactions.length}</Badge>}
      />

      <Panel className="overflow-hidden">
        <div className="p-3 sm:p-4">
          <FilterBar
            filtersLabel={isAr ? 'تصفية' : 'Filters'}
            clearLabel={isAr ? 'مسح الكل' : 'Clear all'}
            doneLabel={isAr ? 'تم' : 'Done'}
            moreLabel={isAr ? 'خيارات أخرى' : 'More options'}
            search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder }}
            filterCount={typeFilter !== 'all' ? 1 : 0}
            onClearFilters={() => {
              setSearch('');
              setTypeFilter('all');
            }}
            inlineControls={
              <Segmented<'all' | 'transfer' | 'usage' | 'receive'>
                aria-label={t.type}
                value={typeFilter}
                onChange={setTypeFilter}
                items={[
                  { id: 'all', label: t.allTypes },
                  { id: 'transfer', label: t.transfer, icon: <ArrowRightLeft /> },
                  { id: 'usage', label: t.usage, icon: <ArrowDownCircle /> },
                  { id: 'receive', label: t.receive, icon: <ArrowUpCircle /> }
                ]}
              />
            }
            filters={
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.type}</p>
                <Segmented<'all' | 'transfer' | 'usage' | 'receive'>
                  value={typeFilter}
                  onChange={setTypeFilter}
                  className="w-full"
                  items={[
                    { id: 'all', label: t.allTypes },
                    { id: 'transfer', label: t.transfer },
                    { id: 'usage', label: t.usage },
                    { id: 'receive', label: t.receive }
                  ]}
                />
              </div>
            }
          />
        </div>

        <DataTable
          columns={columns}
          rows={paginatedTx}
          rowKey={(tx) => tx.id}
          selectAllLabel={isAr ? 'تحديد الكل' : 'Select all'}
          mobileCard={(tx) => (
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-medium text-gray-900 dark:text-white">
                  {isAr ? tx.itemNameAr || tx.itemNameEn : tx.itemNameEn || tx.itemNameAr}
                </p>
                {statusBadge(tx.status)}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                {typeBadge(tx.type)}
                <span className="tnum font-semibold text-gray-700 dark:text-gray-200">
                  {tx.quantity} {tx.unit}
                </span>
                <span className="ms-auto">{new Date(tx.date).toLocaleDateString(locale)}</span>
              </div>
            </div>
          )}
          empty={
            <EmptyState
              size="sm"
              icon={<History />}
              title={t.noTransactionsFound}
              description={
                search.trim() || typeFilter !== 'all'
                  ? isAr
                    ? 'لا نتائج مطابقة لعوامل التصفية الحالية.'
                    : 'No rows match the current filters.'
                  : undefined
              }
            />
          }
        />

        {filteredTx.length > 0 && (
          <div className="border-t border-gray-200 px-3 py-2.5 sm:px-4 dark:border-gray-800">
            <Pagination
              currentPage={page}
              totalItems={filteredTx.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              language={isAr ? 'ar' : 'en'}
            />
          </div>
        )}
      </Panel>
    </div>
  );
};

export default AdminTransactionsLog;
