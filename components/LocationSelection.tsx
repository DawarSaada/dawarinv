import React from 'react';
import { LocationData, LocationId, Language, Theme, UserRole } from '../types';
import { TRANSLATIONS } from '../constants';
import { ArrowRight, Factory, Globe, LogOut, Package, Store, Warehouse } from 'lucide-react';
import AppControls from './AppControls';
import { Badge, Button, Panel, ShellBrand } from './ui';

interface LocationSelectionProps {
  onSelect: (locationId: LocationId) => void;
  onLogout: () => void;
  language: Language;
  availableLocations: LocationData[];
  currentUserRole: UserRole;
  theme?: Theme;
  onToggleTheme?: () => void;
  onToggleLanguage?: () => void;
}

const LocationSelection: React.FC<LocationSelectionProps> = ({
  onSelect,
  onLogout,
  language,
  availableLocations,
  currentUserRole,
  theme,
  onToggleTheme,
  onToggleLanguage
}) => {
  const t = TRANSLATIONS[language];
  const isAr = language === 'ar';

  const canSeeGlobal = currentUserRole === 'admin' || currentUserRole === 'warehouse_manager';

  const getLocationName = (loc: LocationData) => {
    if (loc.id === 'warehouse') return t.warehouse;
    if (loc.id === 'mammal') return t.mammal;
    return isAr ? loc.nameAr || loc.name : loc.name;
  };

  const getLocationDesc = (loc: LocationData) => {
    if (loc.id === 'warehouse') return t.warehouseDesc;
    if (loc.id === 'mammal') return t.mammalDesc;
    return isAr
      ? loc.descriptionAr || loc.description || 'موقع مخزون الفرع'
      : loc.description || 'Branch inventory location';
  };

  const renderIcon = (iconName: string, className: string) => {
    switch (iconName) {
      case 'warehouse':
        return <Warehouse className={className} />;
      case 'factory':
        return <Factory className={className} />;
      case 'store':
        return <Store className={className} />;
      case 'globe':
        return <Globe className={className} />;
      default:
        return <Store className={className} />;
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-950 ${isAr ? 'font-arabic' : ''}`}>
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <ShellBrand
            mark={<Package />}
            title={isAr ? 'مخزون دوار السعادة' : 'Dawar Saada Inventory'}
            subtitle={t.selectLocation}
          />
          <div className="ms-auto flex items-center gap-1.5">
            {theme && onToggleTheme && onToggleLanguage && (
              <AppControls
                language={language}
                theme={theme}
                onToggleTheme={onToggleTheme}
                onToggleLanguage={onToggleLanguage}
              />
            )}
            <Button variant="ghost" icon={<LogOut className="rtl:rotate-180" />} onClick={onLogout}>
              {t.logout}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-2xl">
          <Badge tone="brand">
            {canSeeGlobal ? (isAr ? 'صلاحية كاملة' : 'Full access') : isAr ? 'وصول محدود' : 'Limited access'}
          </Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            {t.selectLocation}
          </h1>
          <p className="mt-2 text-sm text-gray-500 sm:text-base dark:text-gray-400">
            {t.selectLocationSub}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canSeeGlobal && (
            <button
              type="button"
              onClick={() => onSelect('all')}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-brand-700 bg-brand-700 p-5 text-start text-white transition-colors hover:bg-brand-800 sm:p-6"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 [&>svg]:h-5 [&>svg]:w-5">
                <Globe />
              </span>
              <span className="mt-4 text-lg font-semibold">{t.globalInventory}</span>
              <span className="mt-1 text-sm text-brand-100">{t.globalInventoryDesc}</span>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
                {t.accessInventory}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </span>
            </button>
          )}

          {availableLocations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => onSelect(location.id)}
              className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 text-start transition-colors hover:border-brand-500 sm:p-6 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white dark:bg-brand-950 dark:text-brand-400 [&>svg]:h-5 [&>svg]:w-5">
                {renderIcon(location.icon, 'h-5 w-5')}
              </span>
              <span className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                {getLocationName(location)}
              </span>
              <span className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {getLocationDesc(location)}
              </span>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 dark:text-brand-400">
                {t.accessInventory}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>

        <Panel tone="inset" className="mt-8 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isAr
              ? 'اختر الموقع الذي ترغب بإدارة مخزونه. يمكنك التبديل في أي وقت من الشريط الجانبي.'
              : 'Choose the location whose inventory you want to manage. You can switch at any time from the sidebar.'}
          </p>
        </Panel>
      </main>
    </div>
  );
};

export default LocationSelection;
