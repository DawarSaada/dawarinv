import React from 'react';
import { 
  Plus, 
  Shield, 
  Store, 
  Warehouse, 
  Pencil, 
  Trash2 
} from 'lucide-react';
import { User, Language } from '../../types';

interface UserManagementProps {
  users: User[];
  t: any;
  language: Language;
  onOpenCreateModal: () => void;
  onOpenEditModal: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({
  users,
  t,
  language,
  onOpenCreateModal,
  onOpenEditModal,
  onDeleteUser
}) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t.users}</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t.fullSystemAccess}</p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          {t.createUser}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {users.map(user => (
          <div key={user.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl">
                {user.role === 'admin' ? <Shield className="w-6 h-6 text-brand-600" /> : user.role === 'branch_manager' ? <Store className="w-6 h-6 text-blue-600" /> : <Warehouse className="w-6 h-6 text-orange-600" />}
              </div>
              <div className="flex gap-2">
                <button onClick={() => onOpenEditModal(user)} className="p-2 text-gray-400 hover:text-brand-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => onDeleteUser(user)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 truncate">{language === 'ar' ? (user.nameAr || user.name) : user.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">@{user.username}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : user.role === 'branch_manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                {t[user.role]}
              </span>
              {(user.branchName || user.branchNameAr) && (
                <span className="text-xs text-gray-400 truncate">• {language === 'ar' ? (user.branchNameAr || user.branchName) : user.branchName}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserManagement;
