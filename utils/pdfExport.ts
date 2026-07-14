import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PurchaseOrder, Audit, Language, CatalogItem } from '../types';

export const exportPOToPDF = (po: PurchaseOrder, language: Language, catalog: CatalogItem[]) => {
  const doc = new jsPDF();
  const isAr = language === 'ar';
  
  doc.setFontSize(20);
  doc.text(isAr ? 'Purchase Order' : 'Purchase Order', 14, 20); // Fallback to EN if Arabic font is not loaded

  doc.setFontSize(12);
  doc.text(`PO Number: ${po.poNumber}`, 14, 30);
  doc.text(`Date: ${new Date(po.createdAt).toLocaleDateString()}`, 14, 38);
  doc.text(`Status: ${po.status.toUpperCase()}`, 14, 46);
  if (po.expectedDelivery) {
    doc.text(`Expected Delivery: ${po.expectedDelivery}`, 14, 54);
  }

  const tableColumn = [
    isAr ? 'Item' : 'Item',
    isAr ? 'Unit' : 'Unit',
    isAr ? 'Qty' : 'Qty',
    isAr ? 'Unit Price' : 'Unit Price',
    isAr ? 'Total' : 'Total'
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
    startY: 65,
  });

  const finalY = (doc as any).lastAutoTable.finalY || 65;
  doc.text(`Grand Total: SAR ${po.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 14, finalY + 10);

  doc.save(`${po.poNumber}.pdf`);
};

export const exportAuditToPDF = (audit: Audit, language: Language) => {
  const doc = new jsPDF();
  const isAr = language === 'ar';

  doc.setFontSize(20);
  doc.text(`Audit Report`, 14, 20);

  doc.setFontSize(12);
  doc.text(`Title: ${audit.title}`, 14, 30);
  doc.text(`Location: ${audit.locationId}`, 14, 38);
  doc.text(`Date: ${new Date(audit.createdAt).toLocaleDateString()}`, 14, 46);
  doc.text(`Status: ${audit.status.toUpperCase()}`, 14, 54);

  const tableColumn = [
    'Item',
    'System Qty',
    'Counted Qty',
    'Variance'
  ];

  const tableRows = audit.items?.map(item => [
    item.itemNameEn,
    item.systemQuantity.toString(),
    item.countedQuantity !== undefined ? item.countedQuantity.toString() : '-',
    item.variance !== undefined ? item.variance.toString() : '-'
  ]) || [];

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 65,
  });

  doc.save(`Audit_${audit.id.substring(0, 8)}.pdf`);
};
