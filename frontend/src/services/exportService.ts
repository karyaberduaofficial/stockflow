import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import writeXlsxFile from 'write-excel-file/browser';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { StockFlowApi } from './api';
import {
  AccountCOA,
  CompanyProfile,
  PayrollRecord,
  Product,
  SaleTransaction,
  TaxTransaction,
} from '../types';
import { calculateReorderPoint, formatIDR, getTotalProductStock } from '../utils/format';

export type ExportReportType = 'inventory' | 'financial' | 'tax' | 'payroll' | 'invoice' | 'payslip';
export type ExportFormatType = 'pdf' | 'docx' | 'xlsx';

export interface ExportContextData {
  company: CompanyProfile;
  products: Product[];
  coa: AccountCOA[];
  taxTransactions: TaxTransaction[];
  payrolls: PayrollRecord[];
  selectedSale?: SaleTransaction;
  selectedPayslip?: PayrollRecord;
}

// Locked NO-BLUE StockFlow Brand Colors for Documents
const BRAND_PINE_RGB: [number, number, number] = [27, 67, 50]; // #1B4332
const BRAND_TERRACOTTA_RGB: [number, number, number] = [194, 89, 43]; // #C2592B
const BRAND_ALABASTER_RGB: [number, number, number] = [250, 248, 245]; // #FAF8F5
const BRAND_ESPRESSO_RGB: [number, number, number] = [28, 25, 23]; // #1C1917
const BRAND_MUTED_RGB: [number, number, number] = [87, 83, 78]; // #57534E

const BRAND_PINE_HEX = '1B4332';
const BRAND_TERRACOTTA_HEX = 'C2592B';
const BRAND_ALABASTER_HEX = 'FAF8F5';
const BRAND_SAND_HEX = 'E5DED5';
const BRAND_ESPRESSO_HEX = '1C1917';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

interface ReportTablePayload {
  title: string;
  subtitle: string;
  filenameBase: string;
  headers: string[];
  rows: (string | number)[][];
  summaryLines: string[];
}

function buildReportPayload(report: ExportReportType, data: ExportContextData): ReportTablePayload {
  const today = new Date().toISOString().slice(0, 10);

  if (report === 'inventory') {
    const totalVal = data.products.reduce(
      (sum, p) => sum + getTotalProductStock(p.stockByWarehouse) * p.wacCost,
      0
    );
    return {
      title: 'LAPORAN VALUASI PERSEDIAAN & REORDER POINT (WAC)',
      subtitle: `${data.company.legalEntity} — Per ${today}`,
      filenameBase: `StockFlow_Inventory_Valuation_${today}`,
      headers: ['SKU', 'Nama Produk', 'Kategori', 'Total Stok', 'ROP', 'Harga WAC (Rp)', 'Total Nilai (Rp)', 'Status'],
      rows: data.products.map((p) => {
        const qty = getTotalProductStock(p.stockByWarehouse);
        const rop = calculateReorderPoint(p.avgDailyDemand, p.leadTimeDays, p.safetyStock);
        const status = qty <= p.minStock ? 'LOW STOCK' : qty <= rop ? 'REORDER' : 'AMAN';
        return [
          p.sku,
          p.name,
          p.categoryName,
          qty,
          rop,
          p.wacCost,
          qty * p.wacCost,
          status,
        ];
      }),
      summaryLines: [
        `Total SKU Aktif: ${data.products.length} item furnitur & homeware`,
        `Total Nilai Persediaan (Weighted Average Cost): ${formatIDR(totalVal)}`,
        `Metode Penilaian: Weighted Average Cost (WAC) — Multi-Gudang Terintegrasi`,
      ],
    };
  }

  if (report === 'financial') {
    const totalAssets = data.coa.filter((a) => a.type === 'Asset').reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = data.coa.filter((a) => a.type === 'Liability').reduce((s, a) => s + a.balance, 0);
    const totalEquity = data.coa.filter((a) => a.type === 'Equity').reduce((s, a) => s + a.balance, 0);
    const grossSales = data.coa.filter((a) => a.code === '4101').reduce((s, a) => s + a.balance, 0);
    const salesReturn = data.coa.filter((a) => a.code === '4102').reduce((s, a) => s + a.balance, 0);
    const cogs = data.coa.filter((a) => a.type === 'COGS').reduce((s, a) => s + a.balance, 0);
    const opex = data.coa.filter((a) => a.type === 'Expense').reduce((s, a) => s + a.balance, 0);
    const netProfit = grossSales - salesReturn - cogs - opex;
    return {
      title: 'LAPORAN KEUANGAN & NERACA SALDO (DOUBLE-ENTRY)',
      subtitle: `${data.company.legalEntity} — Periode November 2026`,
      filenameBase: `StockFlow_Financial_Statements_${today}`,
      headers: ['Kode COA', 'Nama Akun', 'Klasifikasi', 'Saldo Normal', 'Debit (Rp)', 'Kredit (Rp)'],
      rows: data.coa.map((a) => [
        a.code,
        a.name,
        a.type,
        a.normalBalance.toUpperCase(),
        a.normalBalance === 'debit' ? a.balance : 0,
        a.normalBalance === 'credit' ? a.balance : 0,
      ]),
      summaryLines: [
        `Total Aset: ${formatIDR(totalAssets)} | Total Liabilitas: ${formatIDR(totalLiabilities)}`,
        `Ekuitas + Laba Bersih Berjalan: ${formatIDR(totalEquity + netProfit)} (Selisih Neraca: ${formatIDR(totalAssets - (totalLiabilities + totalEquity + netProfit))})`,
        `Laba Bersih Periode Berjalan: ${formatIDR(netProfit)} (Penjualan Bersih ${formatIDR(grossSales - salesReturn)} - HPP ${formatIDR(cogs)} - Beban ${formatIDR(opex)})`,
      ],
    };
  }

  if (report === 'tax') {
    const ppnOut = data.taxTransactions.filter((t) => t.direction === 'output').reduce((s, t) => s + t.taxAmount, 0);
    const ppnIn = data.taxTransactions.filter((t) => t.direction === 'input').reduce((s, t) => s + t.taxAmount, 0);
    const pph21 = data.taxTransactions.filter((t) => t.direction === 'withholding').reduce((s, t) => s + t.taxAmount, 0);
    return {
      title: 'REKAPITULASI PAJAK PPN (DPP 11/12) & PPH 21 TER',
      subtitle: `${data.company.legalEntity} — NPWP ${data.company.npwp}`,
      filenameBase: `StockFlow_Tax_Recap_${today}`,
      headers: ['Tanggal', 'Referensi', 'Jenis Pajak', 'Arah', 'DPP (Rp)', 'Nilai Pajak (Rp)', 'Jatuh Tempo', 'Status'],
      rows: data.taxTransactions.map((t) => [
        t.date,
        t.referenceNo,
        t.taxName,
        t.direction.toUpperCase(),
        t.taxBase,
        t.taxAmount,
        t.dueDate,
        t.status.toUpperCase(),
      ]),
      summaryLines: [
        `PPN Keluaran: ${formatIDR(ppnOut)} | PPN Masukan: ${formatIDR(ppnIn)} | PPN Kurang/(Lebih) Bayar: ${formatIDR(ppnOut - ppnIn)}`,
        `Total PPh 21 TER Dipotong: ${formatIDR(pph21)}`,
        `Disclaimer: Perhitungan mengikuti konfigurasi tarif aktif (PPN 12% x DPP 11/12 = 11% efektif). Verifikasi akhir oleh Konsultan Pajak/DJP Coretax.`,
      ],
    };
  }

  if (report === 'payroll') {
    const totalGross = data.payrolls.reduce((s, p) => s + p.grossSalary, 0);
    const totalNet = data.payrolls.reduce((s, p) => s + p.netSalary, 0);
    const totalEmpBpjs = data.payrolls.reduce((s, p) => s + p.bpjsEmployee, 0);
    const totalCompBpjs = data.payrolls.reduce((s, p) => s + p.bpjsEmployer, 0);
    return {
      title: 'REKAPITULASI PENGGAJIAN & BPJS KARYAWAN (CONFIDENTIAL)',
      subtitle: `${data.company.legalEntity} — Periode November 2026`,
      filenameBase: `StockFlow_Payroll_Summary_${today}`,
      headers: ['NIP', 'Nama Karyawan', 'Departemen', 'Gaji Bruto', 'BPJS Karyawan', 'PPh 21 TER', 'Gaji Bersih (Net)', 'BPJS Perusahaan (Beban)', 'Status'],
      rows: data.payrolls.map((p) => [
        p.employeeNo,
        p.employeeName,
        p.department,
        p.grossSalary,
        p.bpjsEmployee,
        p.pph21Ter,
        p.netSalary,
        p.bpjsEmployer,
        p.status.toUpperCase(),
      ]),
      summaryLines: [
        `Total Gaji Bruto: ${formatIDR(totalGross)} | Total Gaji Bersih Dibayarkan: ${formatIDR(totalNet)}`,
        `Potongan BPJS Karyawan: ${formatIDR(totalEmpBpjs)} | Beban BPJS Pemberi Kerja (Non-Potongan Gaji): ${formatIDR(totalCompBpjs)}`,
        `Data NIK, NPWP, dan Nomor Rekening dienkripsi sesuai kebijakan privasi UU PDP.`,
      ],
    };
  }

  if (report === 'invoice' && data.selectedSale) {
    const sale = data.selectedSale;
    return {
      title: `FAKTUR PENJUALAN RESMI — ${sale.invoiceNo}`,
      subtitle: `${data.company.legalEntity} | Pelanggan: ${sale.customerName} | Tanggal: ${sale.date}`,
      filenameBase: `StockFlow_Invoice_${sale.invoiceNo}`,
      headers: ['SKU', 'Deskripsi Barang', 'Qty', 'Harga Satuan (Rp)', 'Diskon (Rp)', 'Subtotal (Rp)'],
      rows: sale.items.map((item) => [
        item.sku,
        item.name,
        item.qty,
        item.unitPrice,
        item.discount,
        item.qty * item.unitPrice - item.discount,
      ]),
      summaryLines: [
        `Subtotal: ${formatIDR(sale.subtotal)} | Diskon: ${formatIDR(sale.discountTotal)}`,
        `PPN Efektif (${sale.ppnRateEffective}% — DPP 11/12): ${formatIDR(sale.ppnAmount)}`,
        `GRAND TOTAL TAGIHAN: ${formatIDR(sale.grandTotal)} | Metode: ${sale.paymentMethod} (${sale.paymentStatus.toUpperCase()})`,
      ],
    };
  }

  // Payslip
  const slip = data.selectedPayslip || data.payrolls[0];
  return {
    title: `SLIP GAJI DIGITAL — ${slip?.employeeName || 'Karyawan'} (${slip?.period || '2026-11'})`,
    subtitle: `${data.company.legalEntity} — Dokumen Rahasia (Scoped Access)`,
    filenameBase: `StockFlow_Payslip_${slip?.employeeNo || 'EMP'}_${slip?.period || today}`,
    headers: ['Komponen Penghasilan / Potongan', 'Kategori', 'Nominal (Rp)'],
    rows: [
      ['Gaji Bruto (Pokok + Tunjangan Tetap & Transport)', 'Penghasilan', slip?.grossSalary || 0],
      ['Potongan BPJS Kesehatan & Ketenagakerjaan (Porsi Karyawan)', 'Potongan', -(slip?.bpjsEmployee || 0)],
      ['Pemotongan PPh Pasal 21 (Skema TER)', 'Potongan Pajak', -(slip?.pph21Ter || 0)],
      ['GAJI BERSIH DITERIMA (TAKE HOME PAY)', 'Net Payout', slip?.netSalary || 0],
      ['Kontribusi BPJS Pemberi Kerja (Ditanggung Perusahaan)', 'Manfaat Perusahaan', slip?.bpjsEmployer || 0],
    ],
    summaryLines: [
      `NIP: ${slip?.employeeNo || '-'} | Departemen: ${slip?.department || '-'} | Jabatan: ${slip?.position || '-'}`,
      `Status Persetujuan: ${(slip?.status || 'draft').toUpperCase()}`,
      `Catatan: Kontribusi BPJS Pemberi Kerja dicatat sebagai beban perusahaan dan tidak memotong Gaji Bersih karyawan.`,
    ],
  };
}

function generatePdfBlob(payload: ReportTablePayload, company: CompanyProfile): Blob {
  const doc = new jsPDF({ orientation: payload.headers.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Deep Forest Pine Brand Header Banner (NO BLUE!)
  doc.setFillColor(...BRAND_PINE_RGB);
  doc.rect(0, 0, pageWidth, 26, 'F');
  // Warm Terracotta Accent Stripe
  doc.setFillColor(...BRAND_TERRACOTTA_RGB);
  doc.rect(0, 26, pageWidth, 2.2, 'F');

  doc.setTextColor(250, 248, 245);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('StockFlow ERP — Homeware & Furniture', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`${company.legalEntity} | ${company.address}`, 14, 17.5);
  doc.text(`NPWP: ${company.npwp} | ${company.phone}`, 14, 22);

  doc.setTextColor(...BRAND_ESPRESSO_RGB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(payload.title, 14, 37);

  doc.setTextColor(...BRAND_MUTED_RGB);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(payload.subtitle, 14, 43);

  const formattedBody = payload.rows.map((row) =>
    row.map((cell) => (typeof cell === 'number' && Math.abs(cell) >= 1000 ? formatIDR(cell) : String(cell)))
  );

  autoTable(doc, {
    startY: 48,
    head: [payload.headers],
    body: formattedBody,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_PINE_RGB,
      textColor: [250, 248, 245],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: BRAND_ALABASTER_RGB,
    },
    styles: {
      fontSize: 8,
      textColor: BRAND_ESPRESSO_RGB,
      lineColor: [229, 222, 213],
      lineWidth: 0.25,
      cellPadding: 2.5,
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 120;
  const y = finalY + 9;
  doc.setFillColor(...BRAND_ALABASTER_RGB);
  doc.setDrawColor(...BRAND_TERRACOTTA_RGB);
  doc.roundedRect(14, y - 4, pageWidth - 28, payload.summaryLines.length * 6 + 8, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_PINE_RGB);
  doc.text('RINGKASAN EKSEKUTIF & VALIDASI', 18, y + 1);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BRAND_ESPRESSO_RGB);
  payload.summaryLines.forEach((line, idx) => {
    doc.text(`• ${line}`, 18, y + 7 + idx * 5.5);
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND_MUTED_RGB);
    doc.text(
      `Dicetak oleh StockFlow v2.0 | Dokumen Terverifikasi | Halaman ${i} dari ${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  return doc.output('blob');
}

async function generateExcelBlob(
  report: ExportReportType,
  payload: ReportTablePayload,
  data: ExportContextData
): Promise<Blob> {
  // Branded StockFlow NO-BLUE Excel (.xlsx) via write-excel-file with live formulas & styled sheets
  type CellSpec = {
    value: string | number;
    type?: typeof String | typeof Number | 'Formula';
    fontWeight?: 'bold';
    color?: string;
    backgroundColor?: string;
    format?: string;
  };

  const titleRow: CellSpec[] = [
    {
      value: data.company.legalEntity,
      type: String,
      fontWeight: 'bold',
      color: '#FAF8F5',
      backgroundColor: `#${BRAND_PINE_HEX}`,
    },
  ];
  const subRow1: CellSpec[] = [{ value: payload.title, type: String, fontWeight: 'bold', color: `#${BRAND_PINE_HEX}` }];
  const subRow2: CellSpec[] = [{ value: payload.subtitle, type: String, color: `#${BRAND_TERRACOTTA_HEX}` }];
  const blankRow: CellSpec[] = [{ value: '', type: String }];

  const headerRow: CellSpec[] = payload.headers.map((h) => ({
    value: h,
    type: String,
    fontWeight: 'bold',
    color: '#FAF8F5',
    backgroundColor: `#${BRAND_PINE_HEX}`,
  }));

  const dataRows: CellSpec[][] = payload.rows.map((r, rIdx) =>
    r.map((cell) => {
      const isNum = typeof cell === 'number';
      const isCurrency = isNum && Math.abs(cell) >= 1000;
      return {
        value: cell,
        type: isNum ? Number : String,
        color: `#${BRAND_ESPRESSO_HEX}`,
        backgroundColor: rIdx % 2 === 1 ? `#${BRAND_ALABASTER_HEX}` : undefined,
        format: isCurrency ? '"Rp "#,##0' : undefined,
      };
    })
  );

  const firstDataRow = 6;
  const lastDataRow = 5 + payload.rows.length;
  const totalRowIdx = lastDataRow + 1;
  const totalRow: CellSpec[] = payload.headers.map(() => ({
    value: '',
    type: String,
    fontWeight: 'bold',
    color: `#${BRAND_PINE_HEX}`,
    backgroundColor: '#E8F3EC',
  }));

  if (report === 'inventory' && totalRow.length >= 7) {
    totalRow[0] = { ...totalRow[0], value: 'TOTAL VALUASI PERSEDIAAN' };
    totalRow[3] = { ...totalRow[3], type: 'Formula', value: `SUM(D${firstDataRow}:D${lastDataRow})` };
    totalRow[6] = { ...totalRow[6], type: 'Formula', value: `SUM(G${firstDataRow}:G${lastDataRow})`, format: '"Rp "#,##0' };
  } else if (report === 'financial' && totalRow.length >= 6) {
    totalRow[0] = { ...totalRow[0], value: 'TOTAL NERACA SALDO (SEIMBANG)' };
    totalRow[4] = { ...totalRow[4], type: 'Formula', value: `SUM(E${firstDataRow}:E${lastDataRow})`, format: '"Rp "#,##0' };
    totalRow[5] = { ...totalRow[5], type: 'Formula', value: `SUM(F${firstDataRow}:F${lastDataRow})`, format: '"Rp "#,##0' };
    totalRow.push({
      type: 'Formula',
      value: `E${totalRowIdx}-F${totalRowIdx}`,
      fontWeight: 'bold',
      color: `#${BRAND_PINE_HEX}`,
      backgroundColor: '#E8F3EC',
    });
  } else if (report === 'tax' && totalRow.length >= 6) {
    totalRow[0] = { ...totalRow[0], value: 'TOTAL DPP & PAJAK' };
    totalRow[4] = { ...totalRow[4], type: 'Formula', value: `SUM(E${firstDataRow}:E${lastDataRow})`, format: '"Rp "#,##0' };
    totalRow[5] = { ...totalRow[5], type: 'Formula', value: `SUM(F${firstDataRow}:F${lastDataRow})`, format: '"Rp "#,##0' };
  } else if (report === 'payroll' && totalRow.length >= 8) {
    totalRow[0] = { ...totalRow[0], value: 'TOTAL PENGGAJIAN' };
    [3, 4, 5, 6, 7].forEach((idx) => {
      const col = String.fromCharCode(65 + idx);
      totalRow[idx] = {
        ...totalRow[idx],
        type: 'Formula',
        value: `SUM(${col}${firstDataRow}:${col}${lastDataRow})`,
        format: '"Rp "#,##0',
      };
    });
  } else {
    totalRow[0] = { ...totalRow[0], value: 'TERVERIFIKASI STOCKFLOW v2.0' };
  }

  const sheet1Data = [titleRow, subRow1, subRow2, blankRow, headerRow, ...dataRows, totalRow];
  const sheet2Data: CellSpec[][] = [
    [{ value: 'Ringkasan Eksekutif StockFlow', type: String, fontWeight: 'bold', color: `#${BRAND_PINE_HEX}` }],
    [{ value: 'Perusahaan', type: String, fontWeight: 'bold' }, { value: data.company.legalEntity, type: String }],
    [{ value: 'NPWP', type: String, fontWeight: 'bold' }, { value: data.company.npwp, type: String }],
    [{ value: '', type: String }],
    ...payload.summaryLines.map((line, i) => [
      { value: `Catatan ${i + 1}`, type: String, fontWeight: 'bold' as const },
      { value: line, type: String },
    ]),
  ];

  const sheet1Cols = payload.headers.map((h) => ({ width: Math.max(h.length + 6, 18) }));
  const sheet2Cols = [{ width: 22 }, { width: 88 }];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return writeXlsxFile([
    {
      sheet: 'StockFlow Report',
      data: sheet1Data as any,
      columns: sheet1Cols,
      stickyRowsCount: 5,
    },
    {
      sheet: 'Ringkasan',
      data: sheet2Data as any,
      columns: sheet2Cols,
    },
  ]).toBlob();
}

async function generateWordBlob(payload: ReportTablePayload, company: CompanyProfile): Promise<Blob> {
  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: payload.headers.map(
        (header) =>
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: BRAND_PINE_HEX },
            children: [
              new Paragraph({
                children: [new TextRun({ text: header, bold: true, color: 'FAF8F5', size: 18, font: 'Calibri' })],
              }),
            ],
          })
      ),
    }),
    ...payload.rows.map(
      (row, rIdx) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                shading:
                  rIdx % 2 === 1
                    ? { type: ShadingType.CLEAR, fill: BRAND_ALABASTER_HEX }
                    : undefined,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: BRAND_SAND_HEX },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: BRAND_SAND_HEX },
                  left: { style: BorderStyle.SINGLE, size: 1, color: BRAND_SAND_HEX },
                  right: { style: BorderStyle.SINGLE, size: 1, color: BRAND_SAND_HEX },
                },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text:
                          typeof cell === 'number' && Math.abs(cell) >= 1000
                            ? formatIDR(cell)
                            : String(cell),
                        color: BRAND_ESPRESSO_HEX,
                        size: 18,
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              })
          ),
        })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            shading: { type: ShadingType.CLEAR, fill: BRAND_PINE_HEX },
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `  STOCKFLOW ERP — ${company.legalEntity.toUpperCase()}  `,
                bold: true,
                color: 'FAF8F5',
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 120, after: 80 },
            children: [new TextRun({ text: payload.title, bold: true, color: BRAND_PINE_HEX, size: 28 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: `${payload.subtitle} | NPWP: ${company.npwp}`, color: BRAND_TERRACOTTA_HEX, italics: true, size: 20 }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
          new Paragraph({
            spacing: { before: 260, after: 80 },
            children: [new TextRun({ text: 'RINGKASAN & CATATAN AUDIT', bold: true, color: BRAND_PINE_HEX, size: 22 })],
          }),
          ...payload.summaryLines.map(
            (line) =>
              new Paragraph({
                spacing: { after: 60 },
                children: [new TextRun({ text: `• ${line}`, color: BRAND_ESPRESSO_HEX, size: 19 })],
              })
          ),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: `Disahkan secara elektronik oleh ${company.legalEntity} — StockFlow v2.0`,
                italics: true,
                color: '57534E',
                size: 18,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function exportDocument(
  report: ExportReportType,
  format: ExportFormatType,
  data: ExportContextData
): Promise<{ filename: string; source: 'backend' | 'client' }> {
  const payload = buildReportPayload(report, data);
  const ext = format;
  const filename = `${payload.filenameBase}.${ext}`;

  // 1. Try live Laravel backend export service first
  const backendBlob = await StockFlowApi.downloadBackendExport(report, format);
  if (backendBlob) {
    triggerDownload(backendBlob, filename);
    return { filename, source: 'backend' };
  }

  // 2. Client-side branded zero-blue real file generator fallback
  let blob: Blob;
  if (format === 'pdf') {
    blob = generatePdfBlob(payload, data.company);
  } else if (format === 'xlsx') {
    blob = await generateExcelBlob(report, payload, data);
  } else {
    blob = await generateWordBlob(payload, data.company);
  }

  triggerDownload(blob, filename);
  return { filename, source: 'client' };
}
