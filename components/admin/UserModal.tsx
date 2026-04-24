import React from 'react';
import { X, Save } from 'lucide-react';
import { User, UserRole, LocationData, Language } from '../../types';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingUserId: string | null;
    userForm: any;
    setUserForm: (form: any) => void;
    locationType: 'central' | 'branch';
    setLocationType: (type: 'central' | 'branch') => void;
    handleUserSubmit: (e: React.FormEvent) => void;
    availableLocations: LocationData[];
    t: any;
    language: Language;
}

const UserModal: React.FC<UserModalProps> = ({
    isOpen,
    onClose,
    editingUserId,
    userForm,
    setUserForm,
    locationType,
    setLocationType,
    handleUserSubmit,
    availableLocations,
    t,
    language
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{editingUserId ? t.editUser : t.createUser}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleUserSubmit} className="space-y-4 sm:space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.fullName}</label>
                            <input required type="text" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.fullNameAr || 'Full Name (Arabic)'}</label>
                            <input type="text" value={userForm.nameAr || ''} onChange={e => setUserForm({...userForm, nameAr: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 text-sm" dir="rtl" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.username}</label>
                            <input required type="text" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.password}</label>
                            <input required={!editingUserId} type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 text-sm" placeholder={editingUserId ? t.leaveBlankKeep : ''} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.locationType}</label>
                        <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-xl">
                            <button type="button" onClick={() => setLocationType('central')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${locationType === 'central' ? 'bg-white dark:bg-gray-700 text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t.central}</button>
                            <button type="button" onClick={() => setLocationType('branch')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${locationType === 'branch' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t.branch}</button>
                        </div>
                    </div>

                    {locationType === 'central' ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.role}</label>
                            <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 text-sm">
                                <option value="warehouse_manager">{t.warehouse_manager}</option>
                                <option value="mammal_employee">{t.mammal_employee}</option>
                                <option value="admin">{t.admin}</option>
                            </select>
                        </div>
                    ) : (
                        <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800">
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">{t.userAssignedBranch}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.branchName}</label>
                                    <input required type="text" value={userForm.branchName} onChange={e => setUserForm({...userForm, branchName: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.branchNameAr || 'Branch Name (Arabic)'}</label>
                                    <input type="text" value={userForm.branchNameAr || ''} onChange={e => setUserForm({...userForm, nameAr: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 text-sm" dir="rtl" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.branchCode}</label>
                                <input required type="text" value={userForm.branchCode} onChange={e => setUserForm({...userForm, branchCode: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.accessibleLocations}</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-900">
                                    {availableLocations.map(loc => (
                                        <label key={loc.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded transition-colors">
                                            <input 
                                                type="checkbox" 
                                                checked={userForm.accessibleBranches.includes(loc.id)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setUserForm((prev: any) => ({
                                                        ...prev,
                                                        accessibleBranches: checked 
                                                            ? [...prev.accessibleBranches, loc.id]
                                                            : prev.accessibleBranches.filter((id: string) => id !== loc.id)
                                                    }));
                                                }}
                                                className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                                {loc.id === 'warehouse' ? t.warehouse : loc.id === 'mammal' ? t.mammal : (language === 'ar' ? (loc.nameAr || loc.name) : loc.name)}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 sticky bottom-0 bg-white dark:bg-gray-800">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors border border-gray-200 dark:border-gray-700 text-sm">{t.cancel}</button>
                        <button type="submit" className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 text-sm"><Save className="w-4 h-4" /> {editingUserId ? t.updateUser : t.createUser}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
