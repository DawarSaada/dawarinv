import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Package,
  Search,
  Trash2
} from 'lucide-react';
import { InventoryItem, LocationData, Language, LocationId, User } from '../../types';
import { formatUnit } from '../../utils/units';
import { canWriteLocation, subjectFrom } from '../../services/permissions';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  Panel,
  Segmented,
  StatTile,
  cn,
  type Column
} from '../ui';

interface AdminInventoryViewProps {
  currentInventory: InventoryItem[];
  availableLocations: LocationData[];
  selectedInventoryLocation: string;
  setSelectedInventoryLocation: (id: string) => void;
  t: any;
  language: Language;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onManageLocation: (locationId: LocationId) => void;
  onDeleteItem: (item: InventoryItem) => void;
  /**
   * Used to decide whether the selected branch is writable. Deleting stock in a
   * branch this user cannot write to was previously possible from here.
   */
  currentUser?: User | null;
}

type SortKey = 'name' | 'quantity' | 'category';

const AdminInventoryView: React.FC<AdminInventoryViewProps> = ({
  currentInventory,
  availableLocations,
  selectedInventoryLocation,
  setSelectedInventoryLocation,
  t,
  language,
  onExportExcel,
  onExportPDF,
  onManageLocation,
  onDeleteItem,
  currentUser
}) => {
  const isAr = language === 'ar';
  const canWriteSelected = canWriteLocation(subjectFrom(currentUser), selectedInventoryLocation);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'ok'>('all');
  const [sort, setSort] = useState<{ key: SortKey; order: 'asc' | 'desc' }>({
    key: 'name',
    order: 'asc'
  });

  const activeLocation = availableLocations.find((loc) => loc.id === selectedInventoryLocation);

  const locationLabel = (loc: LocationData) =>
    loc.id === 'warehouse'
      ? t.warehouse
      : loc.id === 'mammal'
        ? t.mammal
        : isAr
          ? loc.nameAr || loc.name
          : loc.name;

  const categories = useMemo(() => {
    const seen = new Set<string>();
    currentInventory.forEach((item) => item.category && seen.add(item.category));
    return Array.from(seen).sort();
  }, [currentInventory]);

  const stats = useMemo(() => {
    const low = currentInventory.filter((item) => item.quantity <= item.minThreshold);
    const units = currentInventory.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
    return { low: low.length, units, total: currentInventory.length };
  }, [currentInventory]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = currentInventory.filter((item) => {
      const matchesSearch =
        !term ||
        (item.nameEn || '').toLowerCase().includes(term) ||
        (item.nameAr || '').toLowerCase().includes(term) ||
        (item.category || '').toLowerCase().includes(term) ||
        (item.barcode || '').toLowerCase().includes(term);
      const matchesCategory = category === 'all' || item.category === category;
      const isLow = item.quantity <= item.minThreshold;
      const matchesStock =
        stockFilter === 'all' || (stockFilter === 'low' ? isLow : !isLow);
      return matchesSearch && matchesCategory && matchesStock;
    });

    const direction = sort.order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === 'quantity') return (a.quantity - b.quantity) * direction;
      if (sort.key === 'category')
        return (a.category || '').localeCompare(b.category || '') * direction;
      const aName = isAr ? a.nameAr || a.nameEn : a.nameEn || a.nameAr;
      const bName = isAr ? b.nameAr || b.nameEn : b.nameEn || b.nameAr;
      return (aName || '').localeCompare(bName || '') * direction;
    });
  }, [currentInventory, search, category, stockFilter, sort, isAr]);

  const onSortChange = (key: string) =>
    setSort((current) => ({
      key: key as SortKey,
      order: current.key === key && current.order === 'asc' ? 'desc' : 'asc'
    }));

  const activeFilters =
    (category !== 'all' ? 1 : 0) + (stockFilter !== 'all' ? 1 : 0) + (search.trim() ? 1 : 0);

  const columns: Column<InventoryItem>[] = [
    {
      key: 'name',
      header: t.itemName,
      sortable: true,
      cell: (item) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900 dark:text-white">
            {isAr ? item.nameAr || item.nameEn : item.nameEn || item.nameAr}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-gray-500 dark:text-gray-400">
            <span className="sm:hidden">{item.category}</span>
            {item.barcode && (
              <span className="hidden font-mono sm:inline">{item.barcode}</span>
            )}
          </p>
        </div>
      )
    },
    {
      key: 'category',
      header: t.category,
      sortable: true,
      hideBelow: 'sm',
      cell: (item) => <span className="text-gray-500 dark:text-gray-400">{item.category}</span>
    },
    {
      key: 'quantity',
      header: t.stockLevel,
      sortable: true,
      align: 'end',
      cell: (item) => (
        <span className="tnum font-semibold text-gray-900 dark:text-white">
          {item.quantity}
          <span className="ms-1 text-2xs font-normal text-gray-400">{formatUnit(item.unit, language)}</span>
        </span>
      )
    },
    {
      key: 'status',
      header: t.status,
      hideBelow: 'md',
      cell: (item) =>
        item.quantity <= item.minThreshold ? (
          <Badge tone="warning" icon={<AlertTriangle />} dot>
            {t.lowStock}
          </Badge>
        ) : (
          <Badge tone="success" dot>
            {t.inStock}
          </Badge>
        )
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t.actions}</span>,
      align: 'end',
      width: 'w-24',
      cell: (item) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            icon={<ExternalLink />}
            aria-label={t.manageLocation}
            title={t.manageLocation}
            onClick={() => onManageLocation(selectedInventoryLocation as LocationId)}
          />
          {canWriteSelected ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 />}
              aria-label={t.delete}
              title={t.delete}
              className="text-danger-600 hover:bg-danger-50 dark:text-danger-500 dark:hover:bg-danger-900/25"
              onClick={() => onDeleteItem(item)}
            />
          ) : (
            <Badge tone="neutral">
              {language === 'ar' ? 'قراءة فقط' : 'Read-only'}
            </Badge>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        sticky={false}
        title={t.inventory}
        subtitle={t.selectLocationSub}
        icon={<Package />}
        actions={
          <>
            <Button icon={<FileSpreadsheet />} onClick={onExportExcel} hideLabelOnMobile>
              {t.exportExcel}
            </Button>
            <Button icon={<FileText />} onClick={onExportPDF} hideLabelOnMobile>
              {t.exportPDF}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t.itemName}
          value={stats.total}
          icon={<Package />}
          tone="brand"
          size="sm"
        />
        <StatTile
          label={isAr ? 'إجمالي الوحدات' : 'Total units'}
          value={stats.units.toLocaleString(isAr ? 'ar-EG' : 'en-US')}
          icon={<FileSpreadsheet />}
          tone="info"
          size="sm"
        />
        <StatTile
          label={t.lowStock}
          value={stats.low}
          tone={stats.low > 0 ? 'warning' : 'success'}
          icon={<AlertTriangle />}
          size="sm"
          active={stockFilter === 'low'}
          onClick={() => setStockFilter((current) => (current === 'low' ? 'all' : 'low'))}
        />
        <StatTile
          label={isAr ? 'الموقع' : 'Location'}
          value={
            <span className="text-base">{activeLocation ? locationLabel(activeLocation) : '—'}</span>
          }
          icon={<ExternalLink />}
          size="sm"
        />
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-gray-200 p-3 dark:border-gray-800">
          <Segmented
            aria-label={t.selectLocation}
            value={selectedInventoryLocation}
            onChange={setSelectedInventoryLocation}
            className="max-w-full overflow-x-auto scrollbar-hide"
            items={availableLocations.map((loc) => ({
              id: loc.id,
              label: locationLabel(loc)
            }))}
          />
        </div>

        <div className="p-3 sm:p-4">
          <FilterBar
            filtersLabel={isAr ? 'تصفية' : 'Filters'}
            clearLabel={isAr ? 'مسح الكل' : 'Clear all'}
            doneLabel={isAr ? 'تم' : 'Done'}
            moreLabel={isAr ? 'خيارات أخرى' : 'More options'}
            search={{
              value: search,
              onChange: setSearch,
              placeholder: t.searchPlaceholder,
              trailingSlot: undefined
            }}
            inlineControls={
              <Segmented<'all' | 'low' | 'ok'>
                aria-label={t.status}
                value={stockFilter}
                onChange={setStockFilter}
                items={[
                  { id: 'all', label: isAr ? 'الكل' : 'All' },
                  { id: 'low', label: t.lowStock, icon: <AlertTriangle /> },
                  { id: 'ok', label: t.inStock }
                ]}
              />
            }
            filterCount={activeFilters}
            onClearFilters={() => {
              setSearch('');
              setCategory('all');
              setStockFilter('all');
            }}
            filters={
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t.category}
                  </p>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    <option value="all">{isAr ? 'كل الفئات' : 'All categories'}</option>
                    {categories.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t.status}
                  </p>
                  <Segmented<'all' | 'low' | 'ok'>
                    value={stockFilter}
                    onChange={setStockFilter}
                    items={[
                      { id: 'all', label: isAr ? 'الكل' : 'All' },
                      { id: 'low', label: t.lowStock },
                      { id: 'ok', label: t.inStock }
                    ]}
                  />
                </div>
              </div>
            }
          />
        </div>

        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(item) => item.id}
          
          mobileCard={(item) => {
            const isLow = item.quantity <= item.minThreshold;
            return (
              <div className="flex flex-col gap-3 py-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {isAr ? item.nameAr : item.nameEn}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1 font-mono font-bold">
                      <span className={isLow ? 'text-danger-600 dark:text-danger-500' : 'text-gray-900 dark:text-gray-100'}>
                        {item.quantity}
                      </span>
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                        {formatUnit(item.unit, language)}
                      </span>
                    </div>
                    {isLow && (
                      <span className="text-2xs font-semibold uppercase text-danger-600 dark:text-danger-500">
                        {t.lowStock}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                  <button
                    onClick={() => onManageLocation(selectedInventoryLocation as any)}
                    className="flex h-8 items-center justify-center rounded-lg bg-gray-50 px-3 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {t.manageLocation}
                  </button>
                  {canWriteSelected && (
                    <button
                      onClick={() => onDeleteItem(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-danger-600 hover:bg-danger-50 dark:text-danger-500 dark:hover:bg-danger-900/25"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          }}
          sort={sort}
          onSortChange={onSortChange}
          selectAllLabel={isAr ? 'تحديد الكل' : 'Select all'}
          summary={
            <span className={cn('tnum')}>
              {isAr
                ? `${visible.length} من ${currentInventory.length} صنف`
                : `${visible.length} of ${currentInventory.length} items`}
            </span>
          }
          empty={
            <EmptyState
              size="sm"
              icon={<Search />}
              title={t.noItemsInList}
              description={
                activeFilters > 0
                  ? isAr
                    ? 'جرّب توسيع نطاق البحث أو مسح عوامل التصفية.'
                    : 'Try a broader search or clear the filters.'
                  : undefined
              }
              action={
                activeFilters > 0 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setCategory('all');
                      setStockFilter('all');
                    }}
                  >
                    {isAr ? 'مسح كل عوامل التصفية' : 'Clear filters'}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Panel>
    </div>
  );
};

export default AdminInventoryView;
