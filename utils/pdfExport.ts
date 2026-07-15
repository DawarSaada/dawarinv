import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { PurchaseOrder, Audit, Language, CatalogItem, Supplier } from '../types';
import { amiriBase64 } from './amiriFont';

// Helper to initialize custom font
const initCustomFont = (doc: jsPDF) => {
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

// Helper to draw watermark
const drawWatermark = (doc: jsPDF) => {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({opacity: 0.1}));
    doc.setFontSize(60);
    doc.setTextColor(200, 200, 200);
    doc.text("DAWAR SAADA", 105, 150, { align: "center", angle: 45 });
    doc.restoreGraphicsState();
  }
};

export const exportPOToPDF = async (po: PurchaseOrder, language: Language, catalog: CatalogItem[], suppliers: Supplier[]) => {
  const doc = new jsPDF();
  initCustomFont(doc);
  const isAr = language === 'ar';
  
  // -- Visual Header --
  doc.setFillColor(234, 88, 12); // Brand Orange
  doc.rect(0, 0, 210, 5, 'F');

  // Brand Name
  doc.setFontSize(22);
  doc.setTextColor(234, 88, 12); 
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? "دوار السعادة" : "DAWAR AL-SAADA"), 105, 20, { align: "center" });
  
  // Brand Subtitle
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, isAr ? "نظام إدارة المخزون" : "Inventory Management System"), 105, 26, { align: "center" });

  // Generate and insert QR Code (Offline Text Summary)
  const qrText = `Dawar Saada PO #${po.poNumber}\nStatus: ${po.status.toUpperCase()}\nTotal: ${po.totalAmount.toFixed(2)} SAR\nDate: ${new Date(po.createdAt).toLocaleDateString('en-US')}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrText, { width: 50, margin: 1 });
    doc.addImage(qrDataUrl, 'PNG', 160, 8, 30, 30);
  } catch (err) {
    console.error("Error generating QR code", err);
  }

  // Document Title
  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? 'طلب شراء' : 'Purchase Order'), 105, 35, { align: "center" });

  // Info Box
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(14, 42, 182, 35, 2, 2, "FD");

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  const col1LabelX = isAr ? 190 : 20;
  const col1ValueX = isAr ? 150 : 50;
  const col2LabelX = isAr ? 90 : 120;
  const col2ValueX = isAr ? 60 : 155;
  const alignConfig = isAr ? { align: "right" as const } : { align: "left" as const };

  // Left/Right Columns (Mirrored for RTL)
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? `رقم الطلب:` : `PO Number:`), col1LabelX, 52, alignConfig);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, po.poNumber), col1ValueX, 52, alignConfig);

  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? `تاريخ الإنشاء:` : `Date Created:`), col1LabelX, 60, alignConfig);
  doc.setFont("Amiri", "normal");
  doc.text(new Date(po.createdAt).toLocaleDateString('en-US'), col1ValueX, 60, alignConfig);

  const supplierObj = suppliers.find(s => s.id === po.supplierId);
  const supplierName = supplierObj ? (isAr ? (supplierObj.nameAr || supplierObj.nameEn) : (supplierObj.nameEn || supplierObj.nameAr)) : po.supplierId;

  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? `المورد:` : `Supplier:`), col1LabelX, 68, alignConfig);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, supplierName), col1ValueX, 68, alignConfig);

  const translateStatus = (status: string, isAr: boolean) => {
    if (!isAr) return status;
    const map: Record<string, string> = {
      'PENDING': 'قيد الانتظار',
      'APPROVED': 'معتمد',
      'REJECTED': 'مرفوض',
      'DELIVERED': 'تم التوصيل'
    };
    return map[status.toUpperCase()] || status;
  };

  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? `الحالة:` : `Status:`), col2LabelX, 52, alignConfig);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, translateStatus(po.status, isAr)), col2ValueX, 52, alignConfig);

  if (po.expectedDelivery) {
    doc.setFont("Amiri", "bold");
    doc.text(formatText(doc, isAr ? `تاريخ التسليم المتوقع:` : `Expected Delivery:`), col2LabelX, 60, alignConfig);
    doc.setFont("Amiri", "normal");
    doc.text(formatText(doc, po.expectedDelivery), col2ValueX, 60, alignConfig);
  }

  doc.setTextColor(0, 0, 0);

  let tableColumn = [
    formatText(doc, isAr ? 'العنصر' : 'Item'),
    formatText(doc, isAr ? 'الوحدة' : 'Unit'),
    formatText(doc, isAr ? 'الكمية' : 'Qty'),
    formatText(doc, isAr ? 'سعر الوحدة (ريال)' : 'Unit Price (SAR)'),
    formatText(doc, isAr ? 'المجموع (ريال)' : 'Total (SAR)')
  ];
  
  let tableRows = po.items?.map(item => {
    const catalogItem = catalog.find(c => c.nameEn === item.itemNameEn || c.nameAr === item.itemNameAr);
    const unit = catalogItem ? catalogItem.unit : 'PCS';
    return [
      formatText(doc, isAr ? (item.itemNameAr || item.itemNameEn) : (item.itemNameEn || item.itemNameAr)),
      formatText(doc, unit),
      item.quantity.toString(),
      item.unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2}),
      (item.quantity * item.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2})
    ];
  }) || [];

  let grandTotalRow = [
      { content: formatText(doc, isAr ? 'الإجمالي الكلي (ريال)' : `Grand Total (SAR)`), colSpan: 4, styles: { halign: isAr ? 'left' : 'right', fontStyle: 'bold' } },
      { content: po.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2}), styles: { halign: isAr ? 'left' : 'right', fontStyle: 'bold' } }
  ] as any[];

  let columnStyles: any = {
    0: { cellWidth: 'auto', halign: isAr ? 'right' : 'left' },
    1: { cellWidth: 20, halign: 'center' },
    2: { cellWidth: 20, halign: 'center' },
    3: { cellWidth: 35, halign: isAr ? 'left' : 'right' },
    4: { cellWidth: 35, halign: isAr ? 'left' : 'right' },
  };

  if (isAr) {
    tableColumn.reverse();
    tableRows = tableRows.map(row => [...row].reverse());
    grandTotalRow.reverse();
    columnStyles = {
      0: { cellWidth: 35, halign: 'left' },
      1: { cellWidth: 35, halign: 'left' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 'auto', halign: 'right' },
    };
  }

  tableRows.push(grandTotalRow);

  autoTable(doc, {
    startY: 85,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: { 
      fillColor: [234, 88, 12], 
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
      font: 'Amiri'
    },
    styles: { 
      fontSize: 9,
      cellPadding: 3,
      overflow: 'linebreak',
      font: 'Amiri'
    },
    columnStyles
  });

  const lastY = (doc as any).lastAutoTable.finalY + 10;
  let currentY = lastY;

  currentY += 15;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, isAr ? 'هذا المستند تم إنشاؤه بواسطة النظام ولا يتطلب توقيعاً أو ختماً.' : 'This is a system generated document and does not require a signature or stamp.'), 105, currentY, { align: "center" });

  drawWatermark(doc);

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, 195, 290, { align: "right" });
      doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 290);
  }

  doc.save(`${po.poNumber}.pdf`);
};

export const exportAuditToPDF = async (audit: Audit, language: Language) => {
  const doc = new jsPDF();
  initCustomFont(doc);
  const isAr = language === 'ar';

  // -- Visual Header --
  doc.setFillColor(234, 88, 12); // Brand Orange
  doc.rect(0, 0, 210, 5, 'F');

  doc.setFontSize(22);
  doc.setTextColor(234, 88, 12); 
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? "دوار السعادة" : "DAWAR AL-SAADA"), 105, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, isAr ? "نظام إدارة المخزون" : 'Inventory Management System'), 105, 26, { align: "center" });

  // Generate and insert QR Code (Offline Text Summary)
  const qrText = `Dawar Saada Audit Report\nLocation: ${audit.locationId.toUpperCase()}\nStatus: ${audit.status.toUpperCase()}\nDate: ${new Date(audit.createdAt).toLocaleDateString('en-US')}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrText, { width: 50, margin: 1 });
    doc.addImage(qrDataUrl, 'PNG', 160, 8, 30, 30);
  } catch (err) {
    console.error("Error generating QR code", err);
  }

  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? 'تقرير جرد المخزون' : 'Inventory Audit Report'), 105, 35, { align: "center" });

  // Info Box
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(14, 42, 182, 25, 2, 2, "FD");

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  const col1LabelX = isAr ? 190 : 20;
  const col1ValueX = isAr ? 150 : 50;
  const col2LabelX = isAr ? 90 : 120;
  const col2ValueX = isAr ? 60 : 150;
  const alignConfig = isAr ? { align: "right" as const } : { align: "left" as const };

  // Left Column
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? `العنوان:` : `Title:`), col1LabelX, 52, alignConfig);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, audit.title), col1ValueX, 52, alignConfig);

  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? `تاريخ الإنشاء:` : `Date Created:`), col1LabelX, 60, alignConfig);
  doc.setFont("Amiri", "normal");
  doc.text(new Date(audit.createdAt).toLocaleDateString('en-US'), col1ValueX, 60, alignConfig);

  // Right Column
  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? `الموقع:` : `Location:`), col2LabelX, 52, alignConfig);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, audit.locationId.toUpperCase()), col2ValueX, 52, alignConfig);

  doc.setFont("Amiri", "bold");
  doc.text(formatText(doc, isAr ? `الحالة:` : `Status:`), col2LabelX, 60, alignConfig);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, audit.status.toUpperCase()), col2ValueX, 60, alignConfig);

  doc.setTextColor(0, 0, 0);

  let tableColumn = [
    formatText(doc, isAr ? 'العنصر' : 'Item'),
    formatText(doc, isAr ? 'الكمية بالنظام' : 'System Qty'),
    formatText(doc, isAr ? 'الكمية الفعلية' : 'Counted Qty'),
    formatText(doc, isAr ? 'التباين' : 'Variance'),
    formatText(doc, isAr ? 'ملاحظات' : 'Notes')
  ];
  
  let tableRows = audit.items?.map(item => {
    const isCounted = item.countedQuantity !== undefined && item.countedQuantity !== null;
    const variance = isCounted ? item.countedQuantity! - item.expectedQuantity : null;
    let varianceText = '-';
    if (variance !== null) {
        varianceText = variance > 0 ? `+${variance}` : `${variance}`;
    }

    return [
      formatText(doc, isAr ? (item.itemNameAr || item.itemNameEn) : (item.itemNameEn || item.itemNameAr)),
      item.expectedQuantity !== undefined ? item.expectedQuantity.toString() : '0',
      item.countedQuantity !== undefined ? item.countedQuantity.toString() : '-',
      formatText(doc, varianceText),
      formatText(doc, item.notes || '-')
    ];
  }) || [];

  let columnStyles: any = {
    0: { cellWidth: 'auto', halign: isAr ? 'right' : 'left' },
    1: { halign: 'center', cellWidth: 35 },
    2: { halign: 'center', cellWidth: 35 },
    3: { halign: 'center', cellWidth: 25 },
    4: { cellWidth: 30, halign: isAr ? 'left' : 'left' } // Left aligned Notes usually ok
  };

  if (isAr) {
    tableColumn.reverse();
    tableRows = tableRows.map(row => [...row].reverse());
    columnStyles = {
      0: { cellWidth: 30, halign: 'right' },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'center', cellWidth: 35 },
      3: { halign: 'center', cellWidth: 35 },
      4: { cellWidth: 'auto', halign: 'right' }
    };
  }

  autoTable(doc, {
    startY: 75,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: { 
      fillColor: [234, 88, 12], 
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
      font: 'Amiri'
    },
    styles: { 
      fontSize: 9,
      cellPadding: 3,
      overflow: 'linebreak',
      font: 'Amiri'
    },
    columnStyles,
    didParseCell: function (data) {
      if (data.section === 'body') {
        // variance column is index 3 in English, but index 1 in Arabic (5 - 1 - 3 = 1)
        const varianceIndex = isAr ? 1 : 3;
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

  const lastY = (doc as any).lastAutoTable.finalY + 10;
  let currentY = lastY;

  currentY += 15;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont("Amiri", "normal");
  doc.text(formatText(doc, isAr ? 'هذا المستند تم إنشاؤه بواسطة النظام ولا يتطلب توقيعاً أو ختماً.' : 'This is a system generated document and does not require a signature or stamp.'), 105, currentY, { align: "center" });

  drawWatermark(doc);

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(formatText(doc, `Page ${i} of ${pageCount}`), 195, 290, { align: "right" });
      doc.text(formatText(doc, `Generated on ${new Date().toLocaleString()}`), 14, 290);
  }

  doc.save(`Audit_${audit.id.substring(0, 8)}.pdf`);
};
