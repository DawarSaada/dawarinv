import React, { useMemo, useState } from 'react';
import {
  PawPrint,
  Pencil,
  Plus,
  Search,
  Shield,
  Store,
  Trash2,
  UserCog,
  Users as UsersIcon,
  Warehouse
} from 'lucide-react';
import { User, Language } from '../../types';
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
  type Column
} from '../ui';

interface UserManagementProps {
  users: User[];
  t: any;
  language: Language;
  onOpenCreateModal: () => void;
  onOpenEditModal: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

const ROLE_ICON: Record<string, React.ReactNode> = {
  admin: <Shield />,
  branch_manager: <Store />,
  warehouse_manager: <Warehouse />,
  mammal_employee: <PawPrint />
};

const ROLE_TONE: Record<string, 'brand' | 'info' | 'warning'> = {
  admin: 'brand',
  branch_manager: 'info',
  warehouse_manager: 'warning',
  mammal_employee: 'neutral' as 'info'
};

const UserManagement: React.FC<UserManagementProps> = ({
  users,
  t,
  language,
  onOpenCreateModal,
  onOpenEditModal,
  onDeleteUser
}) => {
  const isAr = language === 'ar';
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<string>('all');

  const roles = useMemo(() => {
    const seen = new Set<string>();
    users.forEach((user) => seen.add(user.role));
    return Array.from(seen);
  }, [users]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !term ||
        (user.name || '').toLowerCase().includes(term) ||
        (user.nameAr || '').toLowerCase().includes(term) ||
        (user.username || '').toLowerCase().includes(term) ||
        (user.branchName || '').toLowerCase().includes(term);
      return matchesSearch && (role === 'all' || user.role === role);
    });
  }, [users, search, role]);

  const roleCounts = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach((user) => map.set(user.role, (map.get(user.role) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [users]);

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: t.username,
      cell: (user) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 [&>svg]:h-4 [&>svg]:w-4">
            {ROLE_ICON[user.role] ?? <UserCog />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-900 dark:text-white">
              {isAr ? user.nameAr || user.name : user.name}
            </p>
            <p className="truncate font-mono text-2xs text-gray-500 dark:text-gray-400">
              @{user.username}
            </p>
          </div>
        </div>
      )
    },
    {
      key: 'role',
      header: t.role || (isAr ? 'الصفة' : 'Role'),
      cell: (user) => (
        <Badge tone={ROLE_TONE[user.role] ?? 'neutral'} icon={ROLE_ICON[user.role]}>
          {t[user.role] ?? user.role}
        </Badge>
      )
    },
    {
      key: 'branch',
      header: isAr ? 'الفرع' : 'Branch',
      hideBelow: 'sm',
      cell: (user) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {(isAr ? user.branchNameAr || user.branchName : user.branchName) || '—'}
        </span>
      )
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t.actions}</span>,
      align: 'end',
      width: 'w-24',
      cell: (user) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            icon={<Pencil />}
            aria-label={t.edit}
            title={t.edit}
            onClick={() => onOpenEditModal(user)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 />}
            aria-label={t.delete}
            title={t.delete}
            className="text-danger-600 hover:bg-danger-50 dark:text-danger-500 dark:hover:bg-danger-900/25"
            onClick={() => onDeleteUser(user)}
          />
        </div>
      )
    }
  ];

  const activeFilters = (role !== 'all' ? 1 : 0) + (search.trim() ? 1 : 0);

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        sticky={false}
        title={t.users}
        subtitle={t.fullSystemAccess}
        icon={<UsersIcon />}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={onOpenCreateModal}>
            {t.createUser}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={isAr ? 'المستخدمون' : 'Users'} value={users.length} icon={<UsersIcon />} tone="brand" size="sm" />
        {roleCounts.map(([name, count]) => (
          <StatTile
            key={name}
            label={t[name] ?? name}
            value={count}
            icon={ROLE_ICON[name] ?? <UserCog />}
            size="sm"
            active={role === name}
            onClick={() => setRole((current) => (current === name ? 'all' : name))}
          />
        ))}
      </div>

      <Panel className="overflow-hidden">
        <div className="p-3 sm:p-4">
          <FilterBar
            filtersLabel={isAr ? 'تصفية' : 'Filters'}
            clearLabel={isAr ? 'مسح الكل' : 'Clear all'}
            doneLabel={isAr ? 'تم' : 'Done'}
            moreLabel={isAr ? 'خيارات أخرى' : 'More options'}
            search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder }}
            filterCount={activeFilters}
            onClearFilters={() => {
              setSearch('');
              setRole('all');
            }}
            inlineControls={
              <Segmented
                aria-label={t.role}
                value={role}
                onChange={setRole}
                items={[
                  { id: 'all', label: isAr ? 'الكل' : 'All' },
                  ...roles.map((name) => ({ id: name, label: t[name] ?? name, icon: ROLE_ICON[name] }))
                ]}
              />
            }
            filters={
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t.role || (isAr ? 'الصفة' : 'Role')}
                </p>
                <Segmented
                  value={role}
                  onChange={setRole}
                  className="w-full"
                  items={[
                    { id: 'all', label: isAr ? 'الكل' : 'All' },
                    ...roles.map((name) => ({ id: name, label: t[name] ?? name }))
                  ]}
                />
              </div>
            }
          />
        </div>

        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(user) => user.id}
          selectAllLabel={isAr ? 'تحديد الكل' : 'Select all'}
          mobileCard={(user) => (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 [&>svg]:h-4 [&>svg]:w-4">
                {ROLE_ICON[user.role] ?? <UserCog />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900 dark:text-white">
                  {isAr ? user.nameAr || user.name : user.name}
                </p>
                <p className="truncate text-2xs text-gray-500 dark:text-gray-400">@{user.username}</p>
              </div>
              <Badge tone={ROLE_TONE[user.role] ?? 'neutral'}>{t[user.role] ?? user.role}</Badge>
            </div>
          )}
          empty={
            <EmptyState
              size="sm"
              icon={<Search />}
              title={t.noUsersFound || (isAr ? 'لا يوجد مستخدمون' : 'No users found')}
              description={
                activeFilters > 0
                  ? isAr
                    ? 'لا نتائج مطابقة لعوامل التصفية.'
                    : 'No users match the current filters.'
                  : undefined
              }
              action={
                activeFilters > 0 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setRole('all');
                    }}
                  >
                    {isAr ? 'مسح عوامل التصفية' : 'Clear filters'}
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" icon={<Plus />} onClick={onOpenCreateModal}>
                    {t.createUser}
                  </Button>
                )
              }
            />
          }
        />
      </Panel>
    </div>
  );
};

export default UserManagement;
