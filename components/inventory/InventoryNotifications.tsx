import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  Bell,
  Check,
  CheckCircle,
  ChevronDown,
  Clock,
  Download,
  Eye,
  Package,
  XCircle
} from 'lucide-react';
import { Transaction, AppNotification, LocationData, Language } from '../../types';
import { supabase } from '../../services/supabase';
import { TRANSLATIONS } from '../../constants';
import { logger } from '../../utils/logger';
import { Badge, Button, Panel, cn } from '../ui';

interface InventoryNotificationsProps {
  t: any;
  groupedIncoming: [string, Transaction[]][];
  groupedApprovals: [string, Transaction[]][];
  handleDownloadTransfer: (groupId: string, type: 'incoming' | 'outgoing') => void;
  setSelectedTransferGroup: (groupId: string) => void;
  handleBulkAccept: (groupId: string) => void;
  setRejectionTarget: (items: Transaction[]) => void;
  onConfirmOutbound: (tx: Transaction) => void;
  alerts?: AppNotification[];
  language?: Language;
  availableLocations?: LocationData[];
  onOpenTransferDetail?: (groupId: string, type: 'incoming' | 'outgoing' | 'approval') => void;
  /** Preferred way to clear an alert; falls back to a direct write. */
  onMarkAsRead?: (id: string) => void;
}

/** How many rows of each list are rendered before "show all". */
const PREVIEW_COUNT = 3;
const ALERT_PREVIEW_COUNT = 20;

const InventoryNotifications: React.FC<InventoryNotificationsProps> = ({
  t,
  groupedIncoming,
  groupedApprovals,
  handleDownloadTransfer,
  setSelectedTransferGroup,
  handleBulkAccept,
  setRejectionTarget,
  onConfirmOutbound,
  alerts = [],
  language = 'en',
  availableLocations = [],
  onOpenTransferDetail,
  onMarkAsRead
}) => {
  const hasActions = groupedIncoming.length > 0 || groupedApprovals.length > 0;
  const [open, setOpen] = useState(hasActions);
  const [showAllIncoming, setShowAllIncoming] = useState(false);
  const [showAllApprovals, setShowAllApprovals] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const isAr = language === 'ar';
  const unreadAlerts = alerts.filter((alert) => !alert.isRead);

  // Removed auto-hide logic as requested by user to keep banner permanently visible

  const handleMarkAsRead = async (id: string) => {
    if (onMarkAsRead) {
      onMarkAsRead(id);
      return;
    }
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (error) {
      logger.error('Failed to mark notification as read', error);
    }
  };

  const getLocationName = (locationId: string | undefined) => {
    if (!locationId) return '';
    if (locationId === 'warehouse') return t.warehouse;
    if (locationId === 'mammal') return t.mammal;
    const loc = availableLocations.find((item) => item.id === locationId);
    if (!loc) return locationId;
    return isAr ? loc.nameAr || loc.name : loc.name;
  };

  const handleViewTransfer = (groupId: string, type: 'incoming' | 'outgoing' | 'approval') => {
    if (onOpenTransferDetail) {
      onOpenTransferDetail(groupId, type);
    } else {
      setSelectedTransferGroup(groupId);
    }
  };

  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
          month: 'short',
          day: 'numeric'
        })
      : '';

  const renderGroup = (
    groupId: string,
    items: Transaction[],
    kind: 'incoming' | 'approval',
    showAll: boolean,
    toggleShowAll?: () => void,
    index?: number
  ) => {
    if (!showAll && toggleShowAll && (index ?? 0) >= PREVIEW_COUNT) return null;

    const fromName = getLocationName(items[0]?.fromLocation);
    const toName = getLocationName(items[0]?.toLocation);
    const isIncoming = kind === 'incoming';

    return (
      <div
        key={groupId}
        className="rounded-lg border border-gray-200 p-3 transition-colors hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            <span className="font-medium text-gray-900 dark:text-white">{fromName}</span>
            <ArrowRight className="h-3.5 w-3.5 text-gray-400 rtl:rotate-180" />
            <span className="font-medium text-gray-900 dark:text-white">{toName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Download />}
            aria-label={t.exportPDF}
            title={t.exportPDF}
            onClick={() => handleDownloadTransfer(groupId, isIncoming ? 'incoming' : 'outgoing')}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Badge tone={isIncoming ? 'info' : 'warning'} size="sm">
            {isIncoming ? t.awaitingReview : t.waitingForSource}
          </Badge>
          <span className="inline-flex items-center gap-1">
            <Package className="h-3 w-3" />
            {items.length} {t.items}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(items[0]?.date)}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant={isIncoming ? 'primary' : 'secondary'}
            size="sm"
            icon={<Eye />}
            onClick={() => handleViewTransfer(groupId, isIncoming ? 'incoming' : 'approval')}
          >
            {t.reviewTransfer}
          </Button>
          {isIncoming ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<CheckCircle />}
                onClick={() => handleBulkAccept(groupId)}
              >
                {t.receive}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<XCircle />}
                className="text-danger-600 hover:bg-danger-50 dark:text-danger-500 dark:hover:bg-danger-900/25"
                onClick={() => setRejectionTarget(items)}
              >
                {t.reject}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={<CheckCircle />}
              onClick={() => items.forEach((tx) => onConfirmOutbound(tx))}
            >
              {t.confirm}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const summary = [
    {
      id: 'incoming',
      label: t.incomingRequests,
      value: groupedIncoming.length,
      tone: 'info' as const,
      icon: <ArrowDownCircle />
    },
    {
      id: 'approvals',
      label: t.outgoingApprovals,
      value: groupedApprovals.length,
      tone: 'warning' as const,
      icon: <ArrowUpCircle />
    },
    {
      id: 'alerts',
      label: isAr ? 'تنبيهات المخزون' : 'Stock alerts',
      value: unreadAlerts.length,
      tone: 'danger' as const,
      icon: <AlertTriangle />
    }
  ];

  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, ALERT_PREVIEW_COUNT);

  return (
    <Panel className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400 [&>svg]:h-4 [&>svg]:w-4">
          <Bell />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
            {t.notificationCenter}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            {summary.map((entry) => (
              <span key={entry.id} className="inline-flex items-center gap-1">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    entry.value > 0 ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-700'
                  )}
                  aria-hidden
                />
                <span className="tnum font-medium text-gray-700 dark:text-gray-200">
                  {entry.value}
                </span>
                {entry.label}
              </span>
            ))}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 flex-shrink-0 text-gray-400 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-200 p-3.5 dark:border-gray-800">
          {hasActions && (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-2.5">
                <h3 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <ArrowDownCircle className="h-3.5 w-3.5 text-info-500" />
                  {t.incomingRequests}
                  <Badge tone="info" size="sm">
                    {groupedIncoming.length}
                  </Badge>
                </h3>
                {groupedIncoming.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    {t.noItemsInList}
                  </p>
                ) : (
                  <>
                    {groupedIncoming.map(([groupId, items], index) =>
                      renderGroup(groupId, items, 'incoming', showAllIncoming, () =>
                        setShowAllIncoming(true), index
                      )
                    )}
                    {groupedIncoming.length > PREVIEW_COUNT && !showAllIncoming && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setShowAllIncoming(true)}
                      >
                        {isAr
                          ? `عرض كل الطلبات (${groupedIncoming.length})`
                          : `Show all ${groupedIncoming.length} requests`}
                      </Button>
                    )}
                  </>
                )}
              </section>

              <section className="space-y-2.5">
                <h3 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <ArrowUpCircle className="h-3.5 w-3.5 text-warning-500" />
                  {t.outgoingApprovals}
                  <Badge tone="warning" size="sm">
                    {groupedApprovals.length}
                  </Badge>
                </h3>
                {groupedApprovals.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    {t.noTransactionsFound}
                  </p>
                ) : (
                  <>
                    {groupedApprovals.map(([groupId, items], index) =>
                      renderGroup(groupId, items, 'approval', showAllApprovals, () =>
                        setShowAllApprovals(true), index
                      )
                    )}
                    {groupedApprovals.length > PREVIEW_COUNT && !showAllApprovals && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setShowAllApprovals(true)}
                      >
                        {isAr
                          ? `عرض الكل (${groupedApprovals.length})`
                          : `Show all ${groupedApprovals.length}`}
                      </Button>
                    )}
                  </>
                )}
              </section>
            </div>
          )}

          {alerts.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center gap-2">
                <h3 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <AlertTriangle className="h-3.5 w-3.5 text-danger-500" />
                  {isAr ? 'تنبيهات النظام' : 'System alerts'}
                  <Badge tone="danger" size="sm">
                    {alerts.length}
                  </Badge>
                </h3>
                {unreadAlerts.length > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    icon={<Check />}
                    className="ms-auto"
                    onClick={() => unreadAlerts.forEach((alert) => handleMarkAsRead(alert.id))}
                  >
                    {isAr ? 'تحديد الكل كمقروء' : 'Mark all as read'}
                  </Button>
                )}
              </div>

              <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                {visibleAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      'flex flex-col gap-2 p-3 sm:flex-row sm:items-center',
                      alert.isRead
                        ? 'bg-gray-50/60 dark:bg-gray-950/40'
                        : 'bg-white dark:bg-gray-900'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm',
                          alert.isRead
                            ? 'text-gray-500 dark:text-gray-400'
                            : 'font-medium text-gray-900 dark:text-white'
                        )}
                      >
                        {isAr ? alert.messageAr : alert.messageEn}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-2xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        {new Date(alert.createdAt).toLocaleString(isAr ? 'ar-SA' : 'en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {!alert.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<CheckCircle />}
                        onClick={() => handleMarkAsRead(alert.id)}
                      >
                        {isAr ? 'تحديد كمقروء' : 'Mark read'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {alerts.length > ALERT_PREVIEW_COUNT && !showAllAlerts && (
                <Button variant="link" size="sm" onClick={() => setShowAllAlerts(true)}>
                  {isAr
                    ? `عرض كل التنبيهات (${alerts.length})`
                    : `Show all ${alerts.length} alerts`}
                </Button>
              )}
            </section>
          )}
        </div>
      )}
    </Panel>
  );
};

export default InventoryNotifications;
