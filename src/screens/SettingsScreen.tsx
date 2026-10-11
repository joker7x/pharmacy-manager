import React, { useState } from 'react';
import {
  Download,
  Upload,
  RotateCcw,
  Save,
  CheckCircle,
  Building,
  FileJson,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';

export const SettingsScreen: React.FC = () => {
  const {
    settings,
    updateSettings,
    exportBackupJSON,
    importBackupJSON,
    resetToDemo,
    medications,
    sales,
  } = usePharmacy();

  const [form, setForm] = useState({
    pharmacyName: settings.pharmacyName,
    pharmacistInCharge: settings.pharmacistInCharge,
    phone: settings.phone,
    address: settings.address,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pharmacy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importBackupJSON(content);
      if (success) {
        setImportMessage('تمت استعادة النسخة الاحتياطية بنجاح!');
      } else {
        setImportMessage('خطأ: الملف المرفوع غير صالح أو تالف.');
      }
      setTimeout(() => setImportMessage(null), 4000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#0D2420]">إعدادات الصيدلية والنسخ الاحتياطي</h1>
        <p className="text-xs text-[#7A817E] font-medium">
          بيانات الصيدلية الرسمية على الفواتير، وحفظ واسترجاع قاعدة البيانات محليًا
        </p>
      </div>

      {/* Pharmacy Profile Form */}
      <div className="bg-white rounded-3xl border border-[#ECECE8] p-6 shadow-sm space-y-4">
        <h2 className="text-base font-black text-[#0D2420] flex items-center gap-2">
          <Building className="w-5 h-5 text-[#1FA47A]" />
          <span>بيانات الصيدلية ورأس الفاتورة</span>
        </h2>

        <form onSubmit={handleSaveInfo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#0D2420] block mb-1">اسم الصيدلية</label>
              <input
                type="text"
                value={form.pharmacyName}
                onChange={(e) => setForm({ ...form, pharmacyName: e.target.value })}
                className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#0D2420] block mb-1">الصيدلي المسؤول / المدير</label>
              <input
                type="text"
                value={form.pharmacistInCharge}
                onChange={(e) => setForm({ ...form, pharmacistInCharge: e.target.value })}
                className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#0D2420] block mb-1">رقم هاتف الصيدلية</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#0D2420] block mb-1">العنوان</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              className="bg-[#1FA47A] hover:bg-[#15906B] text-white px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>حفظ التعديلات</span>
            </button>
            {savedSuccess && (
              <span className="text-xs font-bold text-[#1FA47A] flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                <span>تم حفظ البيانات بنجاح</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Backup & Restore Panel */}
      <div className="bg-white rounded-3xl border border-[#ECECE8] p-6 shadow-sm space-y-4">
        <h2 className="text-base font-black text-[#0D2420] flex items-center gap-2">
          <FileJson className="w-5 h-5 text-[#1FA47A]" />
          <span>النسخ الاحتياطي واستعادة البيانات</span>
        </h2>
        <p className="text-xs text-[#7A817E]">
          يمكنك تحميل نسخة كاملة من بيانات الصيدلية (الأدوية، المبيعات، الحسابات) كملف JSON آمن على جهازك
          واسترجاعها في أي وقت دون فقدان البيانات.
        </p>

        {importMessage && (
          <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#1FA47A] text-xs font-bold text-[#0D2420]">
            {importMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#ECECE8] space-y-3">
            <span className="text-xs font-bold text-[#0D2420] block">تصدير وحفظ نسخة احتياطية</span>
            <p className="text-[11px] text-[#7A817E]">
              ملف يحتوي على {medications.length} صنف و {sales.length} عملية بيع
            </p>
            <button
              onClick={handleDownloadBackup}
              className="w-full bg-[#0D2420] hover:bg-[#1FA47A] text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>تحميل نسخة احتياطية (JSON)</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#ECECE8] space-y-3">
            <span className="text-xs font-bold text-[#0D2420] block">استعادة من ملف سابق</span>
            <p className="text-[11px] text-[#7A817E]">
              اختر ملف نسخة احتياطية بتنسيق .json لاستبدال البيانات الحالية
            </p>
            <label className="w-full bg-white hover:bg-gray-50 border border-[#ECECE8] text-[#0D2420] py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm">
              <Upload className="w-4 h-4 text-[#1FA47A]" />
              <span>اختيار ملف للاستعادة</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Reset Demo Data Button */}
        <div className="pt-4 border-t border-[#ECECE8] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#C64536] block">إعادة تعيين البيانات التجريبية</span>
            <span className="text-[11px] text-[#7A817E]">
              إعادة ملء الصيدلية بالأدوية والعمليات الافتراضية
            </span>
          </div>
          <button
            onClick={() => {
              if (confirm('هل أنت متأكد من استعادة البيانات التجريبية الافتراضية؟')) {
                resetToDemo();
              }
            }}
            className="bg-[#FCE8E2] hover:bg-[#C64536] hover:text-white text-[#C64536] px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط المصنع</span>
          </button>
        </div>
      </div>
    </div>
  );
};
