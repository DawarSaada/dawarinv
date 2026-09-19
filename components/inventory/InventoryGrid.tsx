import React from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  MapPin,
  MoreVertical,
  Package,
  Pencil,
  Trash2
} from 'lucide-react';
import { InventoryItem, Language } from '../../types';
import { Badge, Button, Checkbox, DataTable, Menu, cn, type Column, type MenuItem } from '../ui';

interface InventoryGridProps {
  filteredItems: InventoryItem[];
  viewMode: 'grid' | 'list' | 'compact';
  language: Language;
  isGlobalView: boolean;
  selectedItemIds: Set<string>;
  toggleItemSelection: (id: string) => void;
  canEditItem: boolean;
  canRecordUsage: boolean;
  activeActionId: string | null;
  setActiveActionId: (id: string | null) => void;
  t: any;
  onEditItem: (item: InventoryItem) => void;
  onRecordUsage: (item: InventoryItem) => void;
  onRecordReceive: (item: InventoryItem) => void;
  onViewHistory: (item: InventoryItem) => void;
  onDeleteItem: (item: InventoryItem) => void;
  isExpiringSoon: (date?: string) => boolean;
  isExpired: (date?: string) => boolean;
}

/**
 * Item list in three densities.
 *
 * Grid renders scannable cards, list and compact render the shared data table
 * so sorting, selection and the action menu behave the same everywhere. The
 * empty state lives in the parent so it can offer the filters/reset actions.
 */
const InventoryGrid: React.FC<InventoryGridProps> = ({
  filteredItems,
  viewMode,
  language,
  isGlobalView,
  selectedItemIds,
  toggleItemSelection,
  canEditItem,
  canRecordUsage,
  t,
  onEditItem,
  onRecordUsage,
  onRecordReceive,
  onViewHistory,
  onDeleteItem,
  isExpiringSoon,
  isExpired
}) => {
  const isAr = language === 'ar';
  if (filteredItems.length === 0) return null;

  const itemName = (item: InventoryItem) => (isAr ? item.nameAr || item.nameEn : item.nameEn || item.nameAr);

  const rowActions = (item: InventoryItem): MenuItem[] => {
    const actions: MenuItem[] = [];

    if (canEditItem) {
      actions.push({
        id: 'edit',
        label: t.edit,
        icon: <Pencil />,
        onSelect: () => onEditItem(item)
      });
    }
    if (canEditItem || canRecordUsage) {
      actions.push({
        id: 'receive',
        label: isAr ? 'تسجيل وارد' : 'Record receive',
        icon: <ArrowUpCircle />,
        onSelect: () => onRecordReceive(item)
      });
      actions.push({
        id: 'usage',
        label: isAr ? 'تسجيل صرف' : 'Record usage',
        icon: <ArrowDownCircle />,
        onSelect: () => onRecordUsage(item)
      });
    }
    actions.push({
      id: 'history',
      label: isAr ? 'سجل الحركة' : 'Item history',
      icon: <Clock />,
      onSelect: () => onViewHistory(item)
    });
    if (canEditItem) {
      actions.push({ id: '__separator__' });
      actions.push({
        id: 'delete',
        label: t.delete,
        icon: <Trash2 />,
        danger: true,
        onSelect: () => onDeleteItem(item)
      });
    }

    return actions;
  };

  const statusBadges = (item: InventoryItem) => {
    const isLowStock = item.quantity <= item.minThreshold;
    const expired = isExpired(item.expirationDate);
    const expiringSoon = isExpiringSoon(item.expirationDate);

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {isLowStock ? (
          <Badge tone="warning" size="sm" icon={<AlertTriangle />}>
            {t.lowStock}
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            {t.inStock}
          </Badge>
        )}
        {expired && (
          <Badge tone="danger" size="sm">
            {isAr ? 'منتهي' : 'Expired'}
          </Badge>
        )}
        {expiringSoon && !expired && (
          <Badge tone="warning" size="sm">
            {isAr ? 'قارب الانتهاء' : 'Expiring soon'}
          </Badge>
        )}
      </div>
    );
  };

  const quantity = (item: InventoryItem, size: 'sm' | 'md' = 'md') => {
    const isLowStock = item.quantity <= item.minThreshold;
    return (
      <span
        className={cn(
          'tnum font-semibold',
          size === 'md' ? 'text-lg' : 'text-sm',
          isLowStock ? 'text-danger-600 dark:text-danger-500' : 'text-gray-900 dark:text-white'
        )}
      >
        {item.quantity}
        <span className="ms-1 text-2xs font-normal text-gray-400">{item.unit}</span>
      </span>
    );
  };

  /* ---------------------------------------------------------------- grid view */
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((item) => {
          const isSelected = selectedItemIds.has(item.id);
          const isLowStock = item.quantity <= item.minThreshold;

          return (
            <div
              key={item.id}
              className={cn(
                'group relative flex flex-col rounded-xl border bg-white p-3.5 transition-colors dark:bg-gray-900',
                isSelected
                  ? 'border-brand-500 ring-1 ring-brand-500/40'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Checkbox
                  checked={isSelected}
                  aria-label={`${isAr ? 'تحديد' : 'Select'} ${itemName(item)}`}
                  onChange={() => toggleItemSelection(item.id)}
                />
                <Menu
                  items={rowActions(item)}
                  width="w-52"
                  trigger={({ toggle, ref, open }) => (
                    <Button
                      ref={ref}
                      variant="ghost"
                      size="sm"
                      icon={<MoreVertical />}
                      aria-haspopup="menu"
                      aria-expanded={open}
                      aria-label={t.actions}
                      onClick={toggle}
                    />
                  )}
                />
              </div>

              <button
                type="button"
                onClick={() => toggleItemSelection(item.id)}
                className="flex flex-1 flex-col items-start gap-2 text-start"
              >
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4',
                    isLowStock
                      ? 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-100'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  )}
                  aria-hidden
                >
                  <Package />
                </span>

                <span className="w-full">
                  <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {itemName(item)}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-gray-500 dark:text-gray-400">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">
                      {item.category}
                    </span>
                    {isGlobalView && item.locationId && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.locationId}
                      </span>
                    )}
                  </span>
                </span>

                <span className="mt-auto flex w-full items-end justify-between gap-2">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-gray-400">
                      {t.stockLevel}
                    </span>
                    {quantity(item)}
                  </span>
                  <span className="mb-0.5">{statusBadges(item)}</span>
                </span>
              </button>

              {!isGlobalView && (canEditItem || canRecordUsage) && (
                <div className="mt-3 flex items-center gap-1.5 border-t border-gray-100 pt-2.5 dark:border-gray-800">
                  {canRecordUsage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ArrowUpCircle />}
                      className="flex-1"
                      onClick={() => onRecordReceive(item)}
                    >
                      {isAr ? 'وارد' : 'Receive'}
                    </Button>
                  )}
                  {canRecordUsage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ArrowDownCircle />}
                      className="flex-1"
                      onClick={() => onRecordUsage(item)}
                    >
                      {isAr ? 'صرف' : 'Usage'}
                    </Button>
                  )}
                  {!canRecordUsage && canEditItem && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Pencil />}
                      className="flex-1"
                      onClick={() => onEditItem(item)}
                    >
                      {t.edit}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /* -------------------------------------------------- list and compact tables */
  const columns: Column<InventoryItem>[] =
    viewMode === 'list'
      ? [
          {
            key: 'item',
            header: t.itemName,
            cell: (item) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900 dark:text-white">
                  {itemName(item)}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-gray-500 dark:text-gray-400">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">
                    {item.category}
                  </span>
                  {isGlobalView && item.locationId && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {item.locationId}
                    </span>
                  )}
                  {item.barcode && <span className="font-mono">{item.barcode}</span>}
                </p>
              </div>
            )
          },
          {
            key: 'quantity',
            header: t.stockLevel,
            align: 'end',
            cell: (item) => quantity(item)
          },
          { key: 'status', header: t.status, cell: (item) => statusBadges(item) },
          {
            key: 'expiry',
            header: isAr ? 'الانتهاء' : 'Expiry',
            hideBelow: 'lg',
            cell: (item) => (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {item.expirationDate || '—'}
              </span>
            )
          },
          {
            key: 'actions',
            header: <span className="sr-only">{t.actions}</span>,
            align: 'end',
            width: 'w-12',
            cell: (item) => (
              <Menu
                items={rowActions(item)}
                width="w-52"
                trigger={({ toggle, ref, open }) => (
                  <Button
                    ref={ref}
                    variant="ghost"
                    size="sm"
                    icon={<MoreVertical />}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label={t.actions}
                    onClick={toggle}
                  />
                )}
              />
            )
          }
        ]
      : [
          {
            key: 'item',
            header: t.itemName,
            cell: (item) => (
              <span className="truncate font-medium text-gray-900 dark:text-white">
                {itemName(item)}
              </span>
            )
          },
          {
            key: 'quantity',
            header: t.stockLevel,
            align: 'end',
            cell: (item) => quantity(item, 'sm')
          },
          {
            key: 'status',
            header: t.status,
            hideBelow: 'md',
            cell: (item) => statusBadges(item)
          },
          {
            key: 'actions',
            header: <span className="sr-only">{t.actions}</span>,
            align: 'end',
            width: 'w-12',
            cell: (item) => (
              <Menu
                items={rowActions(item)}
                width="w-52"
                trigger={({ toggle, ref, open }) => (
                  <Button
                    ref={ref}
                    variant="ghost"
                    size="sm"
                    icon={<MoreVertical />}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label={t.actions}
                    onClick={toggle}
                  />
                )}
              />
            )
          }
        ];

  return (
    <DataTable
      columns={columns}
      rows={filteredItems}
      rowKey={(item) => item.id}
      density={viewMode === 'compact' ? 'compact' : 'comfortable'}
      selection={{
        selectedIds: selectedItemIds,
        onToggle: (id) => toggleItemSelection(id),
        onToggleAll: (next) => {
          filteredItems.forEach((item) => {
            if (next !== selectedItemIds.has(item.id)) toggleItemSelection(item.id);
          });
        }
      }}
      selectAllLabel={isAr ? 'تحديد كل الأصناف' : 'Select all items'}
      mobileCard={(item) => (
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border bg-white p-3 dark:bg-gray-900',
            selectedItemIds.has(item.id)
              ? 'border-brand-500 ring-1 ring-brand-500/40'
              : 'border-gray-200 dark:border-gray-800'
          )}
        >
          <Checkbox
            checked={selectedItemIds.has(item.id)}
            aria-label={`${isAr ? 'تحديد' : 'Select'} ${itemName(item)}`}
            onChange={() => toggleItemSelection(item.id)}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-gray-900 dark:text-white">{itemName(item)}</p>
            <p className="mt-0.5 truncate text-2xs text-gray-500 dark:text-gray-400">
              {item.category}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {quantity(item, 'sm')}
            {item.quantity <= item.minThreshold && (
              <Badge tone="warning" size="sm">
                {t.lowStock}
              </Badge>
            )}
          </div>
        </div>
      )}
    />
  );
};

export default InventoryGrid;
