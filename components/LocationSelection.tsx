import React from 'react';
import { LocationData, LocationId, Language, UserRole } from '../types';
import { TRANSLATIONS } from '../constants';
import { Warehouse, Factory, ArrowRight, LogOut, Store, Globe } from 'lucide-react';

interface LocationSelectionProps {
  onSelect: (locationId: LocationId) => void;
  onLogout: () => void;
  language: Language;
  availableLocations: LocationData[];
  currentUserRole: UserRole;
}

const LocationSelection: React.FC<LocationSelectionProps> = ({ onSelect, onLogout, language, availableLocations, currentUserRole }) => {
  const t = TRANSLATIONS[language];

  const canSeeGlobal = currentUserRole === 'admin' || currentUserRole === 'warehouse_manager';

  const getLocationName = (loc: LocationData) => {
    if (loc.id === 'warehouse') return t.warehouse;
    if (loc.id === 'mammal') return t.mammal;
    return language === 'ar' ? (loc.nameAr || loc.name) : loc.name;
  };

  const getLocationDesc = (loc: LocationData) => {
    if (loc.id === 'warehouse') return t.warehouseDesc;
    if (loc.id === 'mammal') return t.mammalDesc;
    return language === 'ar' ? (loc.descriptionAr || loc.description || 'موقع مخزون الفرع') : (loc.description || 'Branch Inventory Location');
  };

  const renderIcon = (iconName: string, className: string) => {
      switch(iconName) {
          case 'warehouse': return <Warehouse className={className} />;
          case 'factory': return <Factory className={className} />;
          case 'store': return <Store className={className} />;
          case 'globe': return <Globe className={className} />;
          default: return <Store className={className} />;
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-6 transition-colors relative">
      
      {/* Logout Button */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 rtl:left-auto rtl:right-4 sm:rtl:right-6 z-10">
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors border border-gray-200 dark:border-gray-700 text-sm"
        >
          <LogOut className="w-4 h-4 sm:w-5 h-5 rtl:rotate-180" />
          <span className="font-medium">{t.logout}</span>
        </button>
      </div>

      <div className="text-center mb-8 sm:mb-12 mt-20 sm:mt-0 max-w-2xl px-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white font-arabic mb-3">{t.selectLocation}</h1>
        <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300">{t.selectLocationSub}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl w-full px-4">
        {/* Global Overview Card */}
        {canSeeGlobal && (
          <button
            onClick={() => onSelect('all')}
            className="relative group bg-brand-600 text-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 sm:p-8 text-left rtl:text-right flex flex-col min-h-[14rem] sm:h-64 justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 rtl:right-auto rtl:left-0 p-4 sm:p-6 opacity-10 group-hover:opacity-20 transition-opacity">
               <Globe className="w-24 h-24 sm:w-32 sm:h-32" />
            </div>

            <div className="relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/20 flex items-center justify-center mb-4 sm:mb-6">
                 <Globe className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2 line-clamp-1">{t.globalInventory}</h3>
              <p className="text-sm sm:text-base text-brand-100 line-clamp-2">{t.globalInventoryDesc}</p>
            </div>

            <div className="relative z-10 flex items-center text-sm sm:text-base font-semibold mt-4 group-hover:translate-x-2 rtl:group-hover:-translate-x-2 transition-transform">
              {t.accessInventory} <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 rtl:mr-2 rtl:ml-0 rtl:rotate-180" />
            </div>
          </button>
        )}

        {availableLocations.map((location) => (
          <button
            key={location.id}
            onClick={() => onSelect(location.id)}
            className="relative group bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 p-6 sm:p-8 text-left rtl:text-right border border-gray-200 dark:border-gray-700 hover:border-brand-500 dark:hover:border-brand-500 flex flex-col min-h-[14rem] sm:h-64 justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 rtl:right-auto rtl:left-0 p-4 sm:p-6 opacity-5 group-hover:opacity-10 transition-opacity">
               {renderIcon(location.icon, "w-24 h-24 sm:w-32 sm:h-32 text-brand-600 dark:text-brand-500")}
            </div>

            <div className="relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-brand-50 dark:bg-gray-700 flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-brand-600 transition-colors">
                 {renderIcon(location.icon, "w-6 h-6 sm:w-7 sm:h-7 text-brand-600 dark:text-brand-500 group-hover:text-white transition-colors")}
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2 line-clamp-1">{getLocationName(location)}</h3>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 line-clamp-2">{getLocationDesc(location)}</p>
            </div>

            <div className="relative z-10 flex items-center text-sm sm:text-base text-brand-600 dark:text-brand-400 font-semibold mt-4 group-hover:translate-x-2 rtl:group-hover:-translate-x-2 transition-transform">
              {t.accessInventory} <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 rtl:mr-2 rtl:ml-0 rtl:rotate-180" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LocationSelection;