import React, { useState } from 'react';
import { Audit, Language, LocationData, UserRole } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { Search, Plus, ClipboardCheck, Calendar, Play, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';

interface AuditManagementProps {
  audits: Audit[];
  locations: LocationData[];
  userRole: UserRole;
  language: Language;
  onOpenScheduleModal: () => void;
  onOpenPerformModal: (audit: Audit) => void;
  onOpenReviewModal: (audit: Audit) => void;
  onDeleteAudit?: (id: string) => void;
}

const AuditManagement: React.FC<AuditManagementProps> = ({
  audits, locations, userRole, language, onOpenScheduleModal, onOpenPerformModal, onOpenReviewModal, onDeleteAudit
}) => {
  const t = TRANSLATIONS[language];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredAudits = audits.filter(audit => {
    const matchesSearch = audit.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || audit.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'scheduled': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'in_progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pending_review': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    if (language === 'ar') {
      switch(status) {
        case 'scheduled': return 'مجدول';
        case 'in_progress': return 'قيد الجرد';
        case 'pending_review': return 'بانتظار المراجعة';
        case 'completed': return 'مكتمل';
        case 'cancelled': return 'ملغى';
        default: return status;
      }
    }
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getLocationName = (id: string) => {
    return locations.find(l => l.id === id)?.name || id;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-brand-500" />
            {language === 'ar' ? 'إدارة الجرد الدوري' : 'Cycle Counting & Audits'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'جدولة ومراجعة جرد المخزون' : 'Schedule and review inventory audits'}
          </p>
        </div>
        <button 
          onClick={onOpenScheduleModal}
          className="w-full sm:w-auto px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm shadow-brand-500/20"
        >
          <Plus className="w-5 h-5" />
          {language === 'ar' ? 'جدولة جرد' : 'Schedule Audit'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5`} />
          <input
            type="text"
            placeholder={language === 'ar' ? 'ابحث باسم الجرد...' : 'Search by audit title...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white ${language === 'ar' ? 'pr-10 pl-4' : ''}`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
        >
          <option value="all">{language === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
          <option value="scheduled">{language === 'ar' ? 'مجدول' : 'Scheduled'}</option>
          <option value="in_progress">{language === 'ar' ? 'قيد الجرد' : 'In Progress'}</option>
          <option value="pending_review">{language === 'ar' ? 'بانتظار المراجعة' : 'Pending Review'}</option>
          <option value="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAudits.map(audit => (
          <div key={audit.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col group">
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {audit.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 font-medium">
                    📍 {getLocationName(audit.locationId)}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(audit.status)}`}>
                  {getStatusText(audit.status)}
                </span>
              </div>

              <div className="space-y-2 mt-auto">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><Calendar className="w-4 h-4"/> {language === 'ar' ? 'الموعد' : 'Date'}</span>
                  <span className="font-medium dark:text-white">{audit.scheduledDate ? new Date(audit.scheduledDate).toLocaleDateString() : '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'العناصر المراد جردها' : 'Items to Count'}</span>
                  <span className="font-medium dark:text-white">{audit.items?.length || 0}</span>
                </div>
                {audit.status === 'completed' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'تاريخ الاكتمال' : 'Completed'}</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{new Date(audit.completedDate!).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end items-center gap-3">
              {(audit.status === 'scheduled' || audit.status === 'in_progress') && (
                <button 
                  onClick={() => onOpenPerformModal(audit)}
                  className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors w-full justify-center"
                >
                  <Play className="w-4 h-4" />
                  {language === 'ar' ? 'بدء/إكمال الجرد' : 'Perform Audit'}
                </button>
              )}

              {audit.status === 'pending_review' && (
                <button 
                  onClick={() => onOpenReviewModal(audit)}
                  className="text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors w-full justify-center"
                >
                  <AlertCircle className="w-4 h-4" />
                  {language === 'ar' ? 'مراجعة التسويات' : 'Review Variances'}
                </button>
              )}

              {audit.status === 'completed' && (
                <button 
                  onClick={() => onOpenReviewModal(audit)}
                  className="text-gray-600 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors w-full justify-center"
                >
                  <CheckCircle className="w-4 h-4" />
                  {language === 'ar' ? 'عرض النتائج' : 'View Results'}
                </button>
              )}
              
              {userRole === 'admin' && onDeleteAudit && (
                <button
                  onClick={() => setDeleteConfirm(audit.id)}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title={language === 'ar' ? 'حذف الجرد' : 'Delete Audit'}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredAudits.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg">{language === 'ar' ? 'لم يتم العثور على أي جرد.' : 'No audits found.'}</p>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {language === 'ar' ? 'هل أنت متأكد أنك تريد حذف هذا الجرد؟ لا يمكن التراجع عن هذه العملية.' : 'Are you sure you want to delete this audit? This action cannot be undone.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (onDeleteAudit) onDeleteAudit(deleteConfirm);
                  setDeleteConfirm(null);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                {language === 'ar' ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditManagement;
