import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PurchaseOrder, Audit, Language, CatalogItem } from '../types';

export const exportPOToPDF = (po: PurchaseOrder, language: Language, catalog: CatalogItem[]) => {
  const doc = new jsPDF();
  const isAr = language === 'ar';
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(41, 128, 185); // Brand-like blue color
  doc.text('Dawar Saada', 14, 22);
  
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(isAr ? 'Purchase Order' : 'Purchase Order', 14, 30);
  
  // Document Info
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text(`PO Number: ${po.poNumber}`, 14, 45);
  doc.text(`Date: ${new Date(po.createdAt).toLocaleDateString()}`, 14, 50);
  doc.text(`Status: ${po.status.toUpperCase()}`, 14, 55);
  if (po.expectedDelivery) {
    doc.text(`Expected Delivery: ${po.expectedDelivery}`, 14, 60);
  }

  // Draw a line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 65, 196, 65);

  const tableColumn = [
    isAr ? 'Item' : 'Item',
    isAr ? 'Unit' : 'Unit',
    isAr ? 'Qty' : 'Qty',
    isAr ? 'Unit Price (SAR)' : 'Unit Price (SAR)',
    isAr ? 'Total (SAR)' : 'Total (SAR)'
  ];
  
  const tableRows = po.items?.map(item => {
    const catalogItem = catalog.find(c => c.nameEn === item.itemNameEn || c.nameAr === item.itemNameAr);
    const unit = catalogItem ? catalogItem.unit : 'PCS';
    return [
      item.itemNameEn,
      unit,
      item.quantity.toString(),
      item.unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2}),
      (item.quantity * item.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2})
    ];
  }) || [];

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 75,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20 },
      2: { halign: 'right', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 35 },
      4: { halign: 'right', cellWidth: 35 }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 75;
  
  // Grand Total Section
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Grand Total: SAR ${po.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 140, finalY + 15);

  doc.save(`${po.poNumber}.pdf`);
};

export const exportAuditToPDF = (audit: Audit, language: Language) => {
  const doc = new jsPDF();
  const isAr = language === 'ar';

  // Header
  doc.setFontSize(24);
  doc.setTextColor(41, 128, 185);
  doc.text('Dawar Saada', 14, 22);
  
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(`Inventory Audit Report`, 14, 30);

  // Document Info
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text(`Title: ${audit.title}`, 14, 45);
  doc.text(`Location: ${audit.locationId.toUpperCase()}`, 14, 50);
  doc.text(`Date: ${new Date(audit.createdAt).toLocaleDateString()}`, 14, 55);
  doc.text(`Status: ${audit.status.toUpperCase()}`, 14, 60);

  // Draw a line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 65, 196, 65);

  const tableColumn = [
    'Item',
    'System Qty',
    'Counted Qty',
    'Variance'
  ];

  const tableRows = audit.items?.map(item => {
    let varianceText = item.variance !== undefined ? item.variance.toString() : '-';
    if (item.variance && item.variance > 0) varianceText = '+' + varianceText;
    
    return [
      item.itemNameEn,
      item.expectedQuantity !== undefined ? item.expectedQuantity.toString() : '0',
      item.countedQuantity !== undefined ? item.countedQuantity.toString() : '-',
      varianceText
    ];
  }) || [];

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 75,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 35 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 }
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 3) {
        // Color code variance
        const text = data.cell.text[0];
        if (text.startsWith('+')) {
          data.cell.styles.textColor = [39, 174, 96]; // Green
        } else if (text.startsWith('-') && text !== '-') {
          data.cell.styles.textColor = [231, 76, 60]; // Red
        }
      }
    }
  });

  doc.save(`Audit_${audit.id.substring(0, 8)}.pdf`);
};
