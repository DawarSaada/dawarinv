import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Transaction, InventoryItem, Language } from '../types';
import { TRANSLATIONS } from '../constants';

export const exportTransferPDF = (transactions: Transaction[], language: Language, fromLocationName: string, toLocationName: string) => {
  const t = TRANSLATIONS[language];
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const isRtl = language === 'ar';
  const group = transactions[0];
  const dateStr = new Date(group.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');

  // Header
  doc.setFontSize(22);
  doc.setTextColor(234, 88, 12); // Brand color
  doc.text(t.title, isRtl ? 190 : 14, 20, { align: isRtl ? 'right' : 'left' });
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(t.transferDetails, isRtl ? 190 : 14, 30, { align: isRtl ? 'right' : 'left' });

  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const metadataY = 40;
  doc.text(`${t.from}: ${fromLocationName}`, isRtl ? 190 : 14, metadataY, { align: isRtl ? 'right' : 'left' });
  doc.text(`${t.to}: ${toLocationName}`, isRtl ? 190 : 14, metadataY + 5, { align: isRtl ? 'right' : 'left' });
  doc.text(`${t.date}: ${dateStr}`, isRtl ? 190 : 14, metadataY + 10, { align: isRtl ? 'right' : 'left' });
  doc.text(`${t.performedBy}: ${group.performedBy}`, isRtl ? 190 : 14, metadataY + 15, { align: isRtl ? 'right' : 'left' });

  // Table
  const tableData = transactions.map(tx => [
    language === 'ar' ? tx.itemNameAr : tx.itemNameEn,
    `${tx.quantity} ${tx.unit}`
  ]);

  autoTable(doc, {
    startY: 65,
    head: [[t.itemName, t.quantity]],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [234, 88, 12] },
    styles: { font: isRtl ? 'Cairo' : 'helvetica', halign: isRtl ? 'right' : 'left' }
  });

  // --- STAMP & SIGNATURE SECTION ---
  // Determine Y position after table
  let finalY = (doc as any).lastAutoTable.finalY || 100;
  
  // If not enough space, add page
  if (finalY > 230) {
      doc.addPage();
      finalY = 20;
  }

  const sectionY = finalY + 15;
  const stampX = isRtl ? 40 : 160; 
  const stampY = sectionY + 15;

  // Draw Signature Line
  const sigX = isRtl ? 140 : 20;
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.5);
  doc.line(sigX, stampY + 10, sigX + 50, stampY + 10);
  
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(8);
  doc.text(t.performedBy, sigX + 25, stampY + 15, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(group.performedBy, sigX + 25, stampY + 8, { align: 'center' });

  // Draw Official Stamp
  const locationLabel = (fromLocationName || 'WAREHOUSE').toUpperCase();
  const stampColor = [0, 51, 102]; // Navy Blue Ink

  doc.setDrawColor(stampColor[0], stampColor[1], stampColor[2]);
  doc.setTextColor(stampColor[0], stampColor[1], stampColor[2]);
  doc.setLineWidth(1.2);
  doc.circle(stampX, stampY, 20); // Outer ring
  doc.setLineWidth(0.4);
  doc.circle(stampX, stampY, 18); // Inner ring

  // Stamp Text
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  // Top
  doc.text("DAWAR SAADA INVENTORY", stampX, stampY - 12, { align: 'center' });
  // Center
  doc.setFontSize(11);
  doc.text("SENT / DISPATCHED", stampX, stampY, { align: 'center' });
  // Bottom Location
  doc.setFontSize(7);
  doc.text(locationLabel, stampX, stampY + 10, { align: 'center' });
  // Bottom Date
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text(dateStr, stampX, stampY + 14, { align: 'center' });

  doc.save(`Transfer_${group.transferGroupId || group.id}.pdf`);
};

export const exportInventoryExcel = (items: InventoryItem[], locationName: string, language: Language) => {
  const t = TRANSLATIONS[language];
  const data = items.map(item => ({
    [t.itemNameEn]: item.nameEn,
    [t.itemNameAr]: item.nameAr,
    [t.category]: item.category,
    [t.stockLevel]: item.quantity,
    [t.unit]: item.unit,
    [t.lastUpdated]: item.lastUpdated
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  XLSX.writeFile(wb, `Inventory_${locationName}.xlsx`);
};

export const exportDailyReportPDF = (transactions: Transaction[], locationId: string, locationName: string, language: Language, userName: string | undefined, date?: string, getLocationName?: (id: string) => string) => {
  const t = TRANSLATIONS[language];
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const isRtl = language === 'ar';
  
  // Use provided date or today
  const reportDate = date ? new Date(date) : new Date();
  const dateStr = reportDate.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');

  // Separating transactions
  const received = transactions.filter(t => t.type === 'receive' || (t.type === 'transfer' && t.toLocation === locationId));
  const used = transactions.filter(t => t.type === 'usage');

  // Header
  doc.setFontSize(22);
  doc.setTextColor(234, 88, 12); 
  doc.text(t.title, isRtl ? 190 : 14, 20, { align: isRtl ? 'right' : 'left' });
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(`${t.dailyReport} - ${locationName}`, isRtl ? 190 : 14, 30, { align: isRtl ? 'right' : 'left' });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`${t.date}: ${dateStr}`, isRtl ? 190 : 14, 40, { align: isRtl ? 'right' : 'left' });
  if (userName) {
    doc.text(`${t.performedBy}: ${userName}`, isRtl ? 190 : 14, 45, { align: isRtl ? 'right' : 'left' });
  }

  let finalY = 55;

  // --- RECEIVED SECTION ---
  if (received.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(0, 100, 0); // Green title
    doc.text(t.receivedToday, isRtl ? 190 : 14, finalY, { align: isRtl ? 'right' : 'left' });
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [[t.itemName, t.quantity, t.from]],
      body: received.map(tx => [language === 'ar' ? tx.itemNameAr : tx.itemNameEn, `${tx.quantity} ${tx.unit}`, getLocationName ? getLocationName(tx.fromLocation || '') : (tx.fromLocation || '-')]),
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] }, // Green-500
      styles: { font: isRtl ? 'Cairo' : 'helvetica', halign: isRtl ? 'right' : 'left' }
    });
    finalY = (doc as any).lastAutoTable.finalY + 15;
  }

  // --- USED SECTION ---
  if (used.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38); // Red title
    doc.text(t.usedToday, isRtl ? 190 : 14, finalY, { align: isRtl ? 'right' : 'left' });
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [[t.itemName, t.quantity, t.notes]],
      body: used.map(tx => [language === 'ar' ? tx.itemNameAr : tx.itemNameEn, `${tx.quantity} ${tx.unit}`, tx.notes || '-']),
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68] }, // Red-500
      styles: { font: isRtl ? 'Cairo' : 'helvetica', halign: isRtl ? 'right' : 'left' }
    });
    finalY = (doc as any).lastAutoTable.finalY + 15;
  }

  if (received.length === 0 && used.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(t.noTransactionsToday, 105, finalY, { align: 'center' });
    finalY += 20;
  }

  // --- SIGNATURE SECTION ---
  if (finalY > 240) {
      doc.addPage();
      finalY = 20;
  }
  
  const sectionY = finalY + 10;
  
  // Only add signature block if userName is provided (Employee context)
  if (userName) {
    const sigX = 105 - 25; 
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.line(sigX, sectionY + 15, sigX + 50, sectionY + 15);
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(8);
    doc.text(t.performedBy, sigX + 25, sectionY + 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(userName, sigX + 25, sectionY + 13, { align: 'center' });
  }

  doc.save(`DailyReport_${locationName}_${dateStr.replace(/\//g, '-')}.pdf`);
};

export const exportDailyReportExcel = (transactions: Transaction[], locationId: string, locationName: string, language: Language, date: string, getLocationName?: (id: string) => string) => {
    const t = TRANSLATIONS[language];
    
    // Separating transactions
    const received = transactions.filter(t => t.type === 'receive' || (t.type === 'transfer' && t.toLocation === locationId));
    const used = transactions.filter(t => t.type === 'usage');
  
    const wb = XLSX.utils.book_new();
  
    // Received Sheet
    if (received.length > 0) {
      const receivedData = received.map(tx => ({
        [t.date]: new Date(tx.date).toLocaleDateString(),
        [t.itemName]: language === 'ar' ? tx.itemNameAr : tx.itemNameEn,
        [t.quantity]: tx.quantity,
        [t.unit]: tx.unit,
        [t.from]: getLocationName ? getLocationName(tx.fromLocation || '') : (tx.fromLocation || '-'),
        [t.performedBy]: tx.performedBy
      }));
      const wsReceived = XLSX.utils.json_to_sheet(receivedData);
      XLSX.utils.book_append_sheet(wb, wsReceived, "Received");
    }
  
    // Used Sheet
    if (used.length > 0) {
      const usedData = used.map(tx => ({
        [t.date]: new Date(tx.date).toLocaleDateString(),
        [t.itemName]: language === 'ar' ? tx.itemNameAr : tx.itemNameEn,
        [t.quantity]: tx.quantity,
        [t.unit]: tx.unit,
        [t.notes]: tx.notes,
        [t.performedBy]: tx.performedBy
      }));
      const wsUsed = XLSX.utils.json_to_sheet(usedData);
      XLSX.utils.book_append_sheet(wb, wsUsed, "Used");
    }
  
    // If empty
    if (received.length === 0 && used.length === 0) {
        const wsEmpty = XLSX.utils.json_to_sheet([{ Note: "No data for this date" }]);
        XLSX.utils.book_append_sheet(wb, wsEmpty, "Report");
    }
  
    XLSX.writeFile(wb, `DailyReport_${locationName}_${date}.xlsx`);
  };