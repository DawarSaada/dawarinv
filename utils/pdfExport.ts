import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { PurchaseOrder, Audit, Language, CatalogItem, Supplier } from '../types';
import { formatDateDDMMYYYY } from './dateUtils';

let amiriBase64Cache: string | null = null;

const loadAmiriFont = async (): Promise<string | null> => {
  if (amiriBase64Cache) return amiriBase64Cache;
  try {
    const module = await import('./amiriFont');
    amiriBase64Cache = module.amiriBase64;
    return amiriBase64Cache;
  } catch (error) {
    console.error('Could not load the Amiri font; falling back to the default font.', error);
    return null;
  }
};

// Helper to initialize custom font
const initCustomFont = async (doc: jsPDF) => {
  const amiriBase64 = await loadAmiriFont();
  if (!amiriBase64) return;
  doc.addFileToVFS("Amiri-Regular.ttf", amiriBase64);
  doc.addFont("Amiri-Regular.ttf", "Amiri", "normal", "Identity-H");
  doc.addFont("Amiri-Regular.ttf", "Amiri", "bold", "Identity-H");
  doc.setFont("Amiri");
};

// Process Arabic text for correct shaping and RTL
const formatText = (doc: jsPDF, text: string) => {
  if (!text) return '';
  const str = String(text);
  if (/[\u0600-\u06FF]/.test(str)) {
    return (doc as any).processArabic(str);
  }
  return str;
};

// Helper to draw subtle watermark
const drawWatermark = (doc: jsPDF) => {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
    doc.setFontSize(55);
    doc.setTextColor(150, 150, 150);
    doc.text("DAWAR AL-SAADA", 105, 150, { align: "center", angle: 45 });
    doc.restoreGraphicsState();
  }
};

/**
 * Enhanced Purchase Order PDF with Smart QR verification link and modern corporate styling
 */
export const exportPOToPDF = async (
  po: PurchaseOrder,
  language: Language,
  catalog: CatalogItem[],
  suppliers: Supplier[],
  currency: string = 'SAR'
) => {
  const doc = new jsPDF();
  await initCustomFont(doc);

  const isAr = language === 'ar';
  const alignRight = { align: "right" as const };
  const alignLeft = { align: "left" as const };
  const alignCenter = { align: "center" as const };

  // 1. Top Brand Accent Line
  doc.setFillColor(234, 88, 12); // Brand Orange
  doc.rect(0, 0, 210, 4, 'F');

  // 2. Logo Emblem Box
  doc.setFillColor(255, 247, 237); // Orange 50
  doc.setDrawColor(234, 88, 12);
  doc.roundedRect(14, 10, 14, 14, 2, 2, "FD");
  doc.setFont("Amiri", "bold");
  doc.setFontSize(10);
  doc.setTextColor(234, 88, 12);
  doc.text("DS", 21, 19, alignCenter);

  // 3. Brand Title & Subtitle (Clean 2-line title hierarchy guarantees zero collision with right badge)
  doc.setFont("Amiri", "bold");
  doc.setFontSize(13);
  doc.setTextColor(234, 88, 12); // Brand Orange
  const brandMain = isAr ? "مؤسسة دوار السعادة" : "DAWAR AL-SAADA";
  doc.text(formatText(doc, brandMain), 32, 14.5);

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42); // Slate 900
  const brandSub = isAr ? "للوجبات السريعة" : "FAST FOOD ESTABLISHMENT";
  doc.text(formatText(doc, brandSub), 32, 19);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont("Amiri", "normal");
  const brandSubtitle = isAr
    ? "نظام إدارة المخزون والمشتريات المركزية • مستند توريد رسمي"
    : "Central Inventory & Procurement System • Official Supply Order";
  doc.text(formatText(doc, brandSubtitle), 32, 23);

  // 4. Document Type & Status Pill (Top Right)
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(144, 7.5, 52, 6.5, 1.5, 1.5, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? "طلب شراء رسمي" : "OFFICIAL PURCHASE ORDER"), 170, 12, alignCenter);

  doc.setFontSize(9.5);
  doc.setTextColor(234, 88, 12);
  doc.setFont("Amiri", "bold");
  doc.text(po.poNumber, 196, 18, alignRight);

  // Status Badge
  const statusMap: Record<string, { ar: string; en: string; r: number; g: number; b: number; textR: number; textG: number; textB: number }> = {
    APPROVED: { ar: 'معتمد رسمياً', en: 'APPROVED', r: 236, g: 253, b: 245, textR: 5, textG: 150, textB: 105 },
    DELIVERED: { ar: 'تم التوريد', en: 'DELIVERED', r: 239, g: 246, b: 255, textR: 37, textG: 99, textB: 235 },
    PENDING: { ar: 'قيد الاعتماد', en: 'PENDING', r: 255, g: 251, b: 235, textR: 180, textG: 83, textB: 9 },
    REJECTED: { ar: 'مرفوض', en: 'REJECTED', r: 254, g: 242, b: 242, textR: 220, textG: 38, textB: 38 },
  };
  const currentStatus = (po.status || 'PENDING').toUpperCase();
  const statusInfo = statusMap[currentStatus] || statusMap.PENDING;

  doc.setFillColor(statusInfo.r, statusInfo.g, statusInfo.b);
  doc.setDrawColor(statusInfo.textR, statusInfo.textG, statusInfo.textB);
  doc.roundedRect(152, 20.5, 44, 4.5, 2, 2, "FD");
  doc.setFontSize(7);
  doc.setTextColor(statusInfo.textR, statusInfo.textG, statusInfo.textB);
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? `● ${statusInfo.ar}` : `● ${statusInfo.en}`), 174, 24, alignCenter);

  // 5. Metadata 2-Card Grid (Left: Supplier Details | Right: Dates & Destination)
  // Dedicated column offsets guarantee labels and values never overlap in LTR or RTL
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(14, 28, 88, 26, 2, 2, "FD");
  doc.roundedRect(108, 28, 88, 26, 2, 2, "FD");

  const supplierObj = suppliers.find(s => s.id === po.supplierId);
  const supplierName = supplierObj
    ? (isAr ? (supplierObj.nameAr || supplierObj.nameEn) : (supplierObj.nameEn || supplierObj.nameAr))
    : (po.supplierId || '-');

  const locationMap: Record<string, { ar: string; en: string }> = {
    warehouse: { ar: 'المستودع الرئيسي', en: 'Central Warehouse' },
    mammal: { ar: 'المعمل المركزي', en: 'Central Mammal Kitchen' },
    b01: { ar: 'فرع الجوافة (b01)', en: 'Jawafa Branch (b01)' },
    b02: { ar: 'فرع الجامعة (b02)', en: 'Jamia Branch (b02)' },
    b03: { ar: 'فرع حبونا (b03)', en: 'Habuna Branch (b03)' },
  };
  const destinationName = po.locationId && locationMap[po.locationId]
    ? (isAr ? locationMap[po.locationId].ar : locationMap[po.locationId].en)
    : (po.locationId || (isAr ? 'المستودع الرئيسي' : 'Central Warehouse'));

  // Card 1 Content (Supplier Details)
  doc.setFontSize(8);
  doc.setTextColor(234, 88, 12);
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? "بيانات المورد والتسليم / Supplier" : "Supplier & Delivery Info"), isAr ? 98 : 18, 33, isAr ? alignRight : alignLeft);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, isAr ? "المورد:" : "Supplier:"), isAr ? 98 : 18, 38.5, isAr ? alignRight : alignLeft);
  doc.text(formatText(doc, isAr ? "جهة التوريد:" : "Destination:"), isAr ? 98 : 18, 44, isAr ? alignRight : alignLeft);
  doc.text(formatText(doc, isAr ? "المسؤول:" : "Created By:"), isAr ? 98 : 18, 49.5, isAr ? alignRight : alignLeft);

  doc.setTextColor(15, 23, 42);
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, String(supplierName).substring(0, 30)), isAr ? 72 : 48, 38.5, isAr ? alignRight : alignLeft);
  doc.text(formatText(doc, String(destinationName).substring(0, 30)), isAr ? 72 : 48, 44, isAr ? alignRight : alignLeft);
  doc.text(formatText(doc, po.createdBy || 'Admin'), isAr ? 72 : 48, 49.5, isAr ? alignRight : alignLeft);

  // Card 2 Content (Dates & Terms)
  doc.setFontSize(8);
  doc.setTextColor(234, 88, 12);
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? "التواريخ والشروط / Terms & Dates" : "Dates & Terms"), isAr ? 192 : 112, 33, isAr ? alignRight : alignLeft);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, isAr ? "تاريخ الإنشاء:" : "Date Created:"), isAr ? 192 : 112, 38.5, isAr ? alignRight : alignLeft);
  doc.text(formatText(doc, isAr ? "تاريخ التسليم:" : "Expected Delivery:"), isAr ? 192 : 112, 44, isAr ? alignRight : alignLeft);
  doc.text(formatText(doc, isAr ? "طريقة السداد:" : "Payment Terms:"), isAr ? 192 : 112, 49.5, isAr ? alignRight : alignLeft);

  doc.setTextColor(15, 23, 42);
  doc.setFont("Amiri", "bold");
  doc.text(formatDateDDMMYYYY(po.createdAt), isAr ? 164 : 144, 38.5, isAr ? alignRight : alignLeft);
  const formattedDelivery = po.expectedDelivery ? formatDateDDMMYYYY(po.expectedDelivery) : (isAr ? 'حسب الاتفاق' : 'Per Agreement');
  doc.text(formattedDelivery, isAr ? 164 : 144, 44, isAr ? alignRight : alignLeft);
  doc.text(isAr ? 'آجل 30 يوم' : 'Credit 30 Days', isAr ? 164 : 144, 49.5, isAr ? alignRight : alignLeft);

  // 6. Data Table
  let tableColumn = [
    "#",
    formatText(doc, isAr ? 'الصنف / الوصف' : 'Item Description'),
    formatText(doc, isAr ? 'الوحدة' : 'Unit'),
    formatText(doc, isAr ? 'الكمية' : 'Qty'),
    formatText(doc, isAr ? `سعر الوحدة (${currency})` : `Unit Price (${currency})`),
    formatText(doc, isAr ? `المجموع (${currency})` : `Total (${currency})`)
  ];

  let tableRows = po.items?.map((item, index) => {
    const catalogItem = catalog.find(c => c.nameEn === item.itemNameEn || c.nameAr === item.itemNameAr);
    const unit = catalogItem ? catalogItem.unit : 'PCS';
    const totalLine = (item.quantity * item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const nameDisplay = isAr
      ? (item.itemNameAr || item.itemNameEn)
      : (item.itemNameEn || item.itemNameAr);

    return [
      (index + 1).toString(),
      formatText(doc, nameDisplay),
      formatText(doc, unit),
      item.quantity.toString(),
      item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }),
      totalLine
    ];
  }) || [];

  let columnStyles: any = {
    0: { cellWidth: 8, halign: 'center' },
    1: { cellWidth: 'auto', halign: isAr ? 'right' : 'left' },
    2: { cellWidth: 22, halign: 'center' },
    3: { cellWidth: 14, halign: 'center' },
    4: { cellWidth: 26, halign: isAr ? 'left' : 'right' },
    5: { cellWidth: 28, halign: isAr ? 'left' : 'right' },
  };

  if (isAr) {
    tableColumn.reverse();
    tableRows = tableRows.map(row => [...row].reverse());
    columnStyles = {
      0: { cellWidth: 28, halign: 'left' },
      1: { cellWidth: 26, halign: 'left' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 'auto', halign: 'right' },
      5: { cellWidth: 8, halign: 'center' },
    };
  }

  autoTable(doc, {
    startY: 57,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      font: 'Amiri',
      cellPadding: 2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Slate 50
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak',
      font: 'Amiri',
      lineColor: [226, 232, 240]
    },
    columnStyles
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;
  let currentY = finalY + 5;

  // Add new page only if bottom section (requires ~52mm) genuinely overflows page
  if (currentY + 52 > 278) {
    doc.addPage();
    currentY = 15;
  }

  // 7. Smart QR Verification Box (Points to live /verify-po URL)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://inventory.dawarsaada.com';
  const qrUrl = `${baseUrl}/verify-po?id=${encodeURIComponent(po.id)}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 120, margin: 1 });

    // QR Card Container
    doc.setFillColor(255, 247, 237); // Orange 50
    doc.setDrawColor(234, 88, 12); // Brand Orange
    doc.roundedRect(14, currentY, 96, 26, 2, 2, "FD");

    // QR Image inside container
    doc.addImage(qrDataUrl, 'PNG', 16, currentY + 2, 22, 22);

    // Text beside QR
    doc.setFontSize(8);
    doc.setTextColor(154, 52, 18); // Amber 800
    doc.setFont("Amiri", "bold");
    doc.text(formatText(doc, isAr ? "التحقق الرقمي والتوثيق الذكي" : "Digital Verification & Trust"), 42, currentY + 7.5);

    doc.setFontSize(7);
    doc.setTextColor(124, 45, 18);
    doc.setFont("Amiri", "normal");
    doc.text(formatText(doc, isAr ? "امسح بالكاميرا للتأكد من صحة المستند" : "Scan to verify live PO authenticity"), 42, currentY + 13);

    doc.setFontSize(6.5);
    doc.setTextColor(154, 52, 18);
    doc.text(formatText(doc, isAr ? "خوادم دوار السعادة المركزية المشفرة" : "Secured by Dawar Saada Central DB"), 42, currentY + 18);

    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(`ID: ${po.id.substring(0, 18)}...`, 42, currentY + 23);
  } catch (err) {
    console.error("Error generating QR code", err);
  }

  // 8. Financial Summary Box (Right Side)
  const subtotal = (po.totalAmount / 1.15);
  const vat = po.totalAmount - subtotal;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(116, currentY, 80, 26, 2, 2, "FD");

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, isAr ? "المجموع قبل الضريبة:" : "Subtotal:"), isAr ? 192 : 120, currentY + 6, isAr ? alignRight : alignLeft);
  doc.text(formatText(doc, isAr ? "ضريبة القيمة المضافة (15%):" : "VAT (15%):"), isAr ? 192 : 120, currentY + 11.5, isAr ? alignRight : alignLeft);

  doc.setFont("Amiri", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`, isAr ? 120 : 192, currentY + 6, isAr ? alignLeft : alignRight);
  doc.text(`${vat.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`, isAr ? 120 : 192, currentY + 11.5, isAr ? alignLeft : alignRight);

  // Grand Total Banner inside Box
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(234, 88, 12);
  doc.rect(116, currentY + 16, 80, 10, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(234, 88, 12);
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? "الإجمالي الكلي النهائي:" : "Grand Total:"), isAr ? 192 : 120, currentY + 22.5, isAr ? alignRight : alignLeft);
  doc.text(`${po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`, isAr ? 120 : 192, currentY + 22.5, isAr ? alignLeft : alignRight);

  // 9. Signatures Block
  const sigY = currentY + 32;
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineDashPattern([2, 2], 0);

  // Signature lines at sigY + 14, title labels at sigY + 18.5
  // Signature 1
  doc.line(18, sigY + 14, 88, sigY + 14);
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? "إعداد واعتماد قسم المشتريات / Authorized By" : "Authorized Procurement Signoff"), 53, sigY + 18.5, alignCenter);

  // Signature 2
  doc.line(122, sigY + 14, 192, sigY + 14);
  doc.text(formatText(doc, isAr ? "استلام وتأكيد المورد أو المستودع / Received By" : "Supplier / Warehouse Receipt"), 157, sigY + 18.5, alignCenter);

  doc.setLineDashPattern([], 0); // reset line dash

  // 10. Background Watermark
  drawWatermark(doc);

  // 11. Running Footer (All Pages)
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(241, 245, 249);
    doc.line(14, 284, 196, 284);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.setFont("Amiri", "normal");
    doc.text(formatText(doc, isAr ? "مستند مشفر ومسجل بنظام دوار السعادة المركزي • لا يتطلب ختماً يدوياً" : "Official System Generated Document • Secured by Dawar Al-Saada"), 14, 289);
    doc.text(formatText(doc, `Page ${i} of ${pageCount}`), 196, 289, alignRight);
  }

  doc.save(`${po.poNumber}.pdf`);
};

/**
 * Enhanced Audit Report PDF with modern corporate styling
 */
export const exportAuditToPDF = async (audit: Audit, language: Language) => {
  const doc = new jsPDF();
  await initCustomFont(doc);

  const isAr = language === 'ar';
  const alignRight = { align: "right" as const };
  const alignLeft = { align: "left" as const };
  const alignCenter = { align: "center" as const };

  // Top Accent Bar
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 0, 210, 4, 'F');

  // Logo Emblem Box
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(234, 88, 12);
  doc.roundedRect(14, 10, 14, 14, 2, 2, "FD");
  doc.setFont("Amiri", "bold");
  doc.setFontSize(10);
  doc.setTextColor(234, 88, 12);
  doc.text("DS", 21, 19, alignCenter);

  // 3. Brand Title & Subtitle (Clean 2-line title hierarchy guarantees zero collision with right badge)
  doc.setFont("Amiri", "bold");
  doc.setFontSize(13);
  doc.setTextColor(234, 88, 12); // Brand Orange
  const brandMain = isAr ? "مؤسسة دوار السعادة" : "DAWAR AL-SAADA";
  doc.text(formatText(doc, brandMain), 32, 14.5);

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42); // Slate 900
  const brandSub = isAr ? "للوجبات السريعة" : "FAST FOOD ESTABLISHMENT";
  doc.text(formatText(doc, brandSub), 32, 19);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont("Amiri", "normal");
  const brandSubtitle = isAr
    ? "تقرير جرد المخزون الدوري والمطابقة"
    : "Periodic Inventory Audit & Reconciliation Report";
  doc.text(formatText(doc, brandSubtitle), 32, 23);

  // Document Title Badge
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(144, 7.5, 52, 6.5, 1.5, 1.5, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? "تقرير جرد المخزون" : "INVENTORY AUDIT REPORT"), 170, 12, alignCenter);

  // Audit Info Box (Structured 2-column layout prevents any overlap)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 28, 182, 22, 2, 2, "FD");

  const col1LabelX = isAr ? 190 : 20;
  const col1ValX = isAr ? 160 : 48;
  const col2LabelX = isAr ? 98 : 112;
  const col2ValX = isAr ? 70 : 142;

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, isAr ? "عنوان الجرد:" : "Audit Title:"), col1LabelX, 35, isAr ? alignRight : alignLeft);
  doc.text(formatText(doc, isAr ? "تاريخ الجرد:" : "Date Created:"), col1LabelX, 42, isAr ? alignRight : alignLeft);

  doc.text(formatText(doc, isAr ? "موقع الجرد:" : "Location:"), col2LabelX, 35, isAr ? alignRight : alignLeft);
  doc.text(formatText(doc, isAr ? "الحالة:" : "Status:"), col2LabelX, 42, isAr ? alignRight : alignLeft);

  doc.setFont("Amiri", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(formatText(doc, audit.title || '-'), col1ValX, 35, isAr ? alignRight : alignLeft);
  doc.text(formatDateDDMMYYYY(audit.createdAt), col1ValX, 42, isAr ? alignRight : alignLeft);

  doc.text(formatText(doc, audit.locationId.toUpperCase()), col2ValX, 35, isAr ? alignRight : alignLeft);
  doc.text(formatText(doc, audit.status.toUpperCase()), col2ValX, 42, isAr ? alignRight : alignLeft);

  // Table
  let tableColumn = [
    "#",
    formatText(doc, isAr ? 'الصنف / الوصف' : 'Item Description'),
    formatText(doc, isAr ? 'الكمية بالنظام' : 'System Qty'),
    formatText(doc, isAr ? 'الكمية الفعلية' : 'Counted Qty'),
    formatText(doc, isAr ? 'التباين' : 'Variance'),
    formatText(doc, isAr ? 'ملاحظات' : 'Notes')
  ];

  let tableRows = audit.items?.map((item, index) => {
    const isCounted = item.countedQuantity !== undefined && item.countedQuantity !== null;
    const variance = isCounted ? item.countedQuantity! - item.expectedQuantity : null;
    let varianceText = '-';
    if (variance !== null) {
      varianceText = variance > 0 ? `+${variance}` : `${variance}`;
    }

    return [
      (index + 1).toString(),
      formatText(doc, isAr ? (item.itemNameAr || item.itemNameEn) : (item.itemNameEn || item.itemNameAr)),
      item.expectedQuantity !== undefined ? item.expectedQuantity.toString() : '0',
      item.countedQuantity !== undefined ? item.countedQuantity.toString() : '-',
      formatText(doc, varianceText),
      formatText(doc, item.notes || '-')
    ];
  }) || [];

  let columnStyles: any = {
    0: { cellWidth: 10, halign: 'center' },
    1: { cellWidth: 'auto', halign: isAr ? 'right' : 'left' },
    2: { halign: 'center', cellWidth: 26 },
    3: { halign: 'center', cellWidth: 26 },
    4: { halign: 'center', cellWidth: 24 },
    5: { cellWidth: 32, halign: isAr ? 'right' : 'left' }
  };

  if (isAr) {
    tableColumn.reverse();
    tableRows = tableRows.map(row => [...row].reverse());
    columnStyles = {
      0: { cellWidth: 32, halign: 'right' },
      1: { halign: 'center', cellWidth: 24 },
      2: { halign: 'center', cellWidth: 26 },
      3: { halign: 'center', cellWidth: 26 },
      4: { cellWidth: 'auto', halign: 'right' },
      5: { cellWidth: 10, halign: 'center' }
    };
  }

  autoTable(doc, {
    startY: 58,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
      font: 'Amiri',
      cellPadding: 3
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      overflow: 'linebreak',
      font: 'Amiri',
      lineColor: [226, 232, 240]
    },
    columnStyles,
    didParseCell: function (data) {
      if (data.section === 'body') {
        const varianceIndex = isAr ? 1 : 4;
        if (data.column.index === varianceIndex) {
          const text = data.cell.text[0];
          if (text && text.includes('+')) {
            data.cell.styles.textColor = [39, 174, 96]; // Green
          } else if (text && text.includes('-') && text !== '-') {
            data.cell.styles.textColor = [231, 76, 60]; // Red
          }
        }
      }
    }
  });

  drawWatermark(doc);

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(241, 245, 249);
    doc.line(14, 284, 196, 284);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.setFont("Amiri", "normal");
    doc.text(formatText(doc, isAr ? "تقرير تدقيق إلكتروني • نظام دوار السعادة المركزي" : "Electronic Audit Report • Dawar Al-Saada"), 14, 289);
    doc.text(formatText(doc, `Page ${i} of ${pageCount}`), 196, 289, alignRight);
  }

  doc.save(`Audit_${audit.id.substring(0, 8)}.pdf`);
};
