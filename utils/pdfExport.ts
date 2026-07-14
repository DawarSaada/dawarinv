import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { PurchaseOrder, Audit, Language, CatalogItem } from '../types';
import { cairoBase64 } from './cairoFont';

// Helper to initialize custom font
const initCustomFont = (doc: jsPDF) => {
  doc.addFileToVFS("Cairo-Regular.ttf", cairoBase64);
  doc.addFont("Cairo-Regular.ttf", "Cairo", "normal");
  doc.addFont("Cairo-Regular.ttf", "Cairo", "bold");
  doc.setFont("Cairo");
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

export const exportPOToPDF = async (po: PurchaseOrder, language: Language, catalog: CatalogItem[]) => {
  const doc = new jsPDF();
  initCustomFont(doc);
  const isAr = language === 'ar';
  
  // -- Visual Header --
  doc.setFillColor(234, 88, 12); // Brand Orange
  doc.rect(0, 0, 210, 5, 'F');

  // Brand Name
  doc.setFontSize(22);
  doc.setTextColor(234, 88, 12); 
  doc.setFont("Cairo", "bold");
  doc.text("DAWAR AL-SAADA", 105, 20, { align: "center" });
  
  // Brand Subtitle
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("Cairo", "normal");
  doc.text('Inventory Management System', 105, 25, { align: "center" });

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
  doc.setFont("helvetica", "bold");
  doc.text(isAr ? 'Purchase Order' : 'Purchase Order', 105, 35, { align: "center" });

  // Info Box
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(14, 42, 182, 30, 2, 2, "FD");

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  // Left Column
  doc.setFont("helvetica", "bold");
  doc.text(`PO Number:`, 20, 52);
  doc.setFont("helvetica", "normal");
  doc.text(po.poNumber, 50, 52);

  doc.setFont("helvetica", "bold");
  doc.text(`Date Created:`, 20, 60);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(po.createdAt).toLocaleDateString('en-US'), 50, 60);

  // Right Column
  doc.setFont("helvetica", "bold");
  doc.text(`Status:`, 120, 52);
  doc.setFont("helvetica", "normal");
  doc.text(po.status.toUpperCase(), 150, 52);

  if (po.expectedDelivery) {
    doc.setFont("helvetica", "bold");
    doc.text(`Expected Delivery:`, 120, 60);
    doc.setFont("helvetica", "normal");
    doc.text(po.expectedDelivery, 155, 60);
  }

  doc.setTextColor(0, 0, 0);

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

  tableRows.push([
      { content: `Grand Total (SAR)`, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: po.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2}), styles: { halign: 'right', fontStyle: 'bold' } }
  ]);

  autoTable(doc, {
    startY: 80,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: { 
      fillColor: [234, 88, 12], 
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { 
      fontSize: 9,
      cellPadding: 3,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    }
  });

  const lastY = (doc as any).lastAutoTable.finalY + 10;
  let currentY = lastY;

  currentY += 15;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont("Cairo", "italic");
  doc.text(isAr ? 'هذا المستند تم إنشاؤه بواسطة النظام ولا يتطلب توقيعاً أو ختماً.' : 'This is a system generated document and does not require a signature or stamp.', 105, currentY, { align: "center" });

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
  doc.setFont("Cairo", "bold");
  doc.text("DAWAR AL-SAADA", 105, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("Cairo", "normal");
  doc.text('Inventory Management System', 105, 25, { align: "center" });

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
  doc.setFont("helvetica", "bold");
  doc.text('Inventory Audit Report', 105, 35, { align: "center" });

  // Info Box
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(14, 42, 182, 30, 2, 2, "FD");

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  doc.setFont("helvetica", "bold");
  doc.text(`Title:`, 20, 52);
  doc.setFont("helvetica", "normal");
  doc.text(audit.title, 50, 52);

  doc.setFont("helvetica", "bold");
  doc.text(`Date Created:`, 20, 60);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(audit.createdAt).toLocaleDateString('en-US'), 50, 60);

  doc.setFont("helvetica", "bold");
  doc.text(`Location:`, 120, 52);
  doc.setFont("helvetica", "normal");
  doc.text(audit.locationId.toUpperCase(), 150, 52);

  doc.setFont("helvetica", "bold");
  doc.text(`Status:`, 120, 60);
  doc.setFont("helvetica", "normal");
  doc.text(audit.status.toUpperCase(), 150, 60);

  doc.setTextColor(0, 0, 0);

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
    startY: 80,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: { 
      fillColor: [234, 88, 12], 
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { 
      fontSize: 9,
      cellPadding: 3,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 35 },
      2: { halign: 'center', cellWidth: 35 },
      3: { halign: 'center', cellWidth: 35 }
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 3) {
        const text = data.cell.text[0];
        if (text.startsWith('+')) {
          data.cell.styles.textColor = [39, 174, 96]; // Green
        } else if (text.startsWith('-') && text !== '-') {
          data.cell.styles.textColor = [231, 76, 60]; // Red
        }
      }
    }
  });

  const lastY = (doc as any).lastAutoTable.finalY + 10;
  let currentY = lastY;

  currentY += 15;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont("Cairo", "italic");
  doc.text(isAr ? 'هذا المستند تم إنشاؤه بواسطة النظام ولا يتطلب توقيعاً أو ختماً.' : 'This is a system generated document and does not require a signature or stamp.', 105, currentY, { align: "center" });

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

  doc.save(`Audit_${audit.id.substring(0, 8)}.pdf`);
};
