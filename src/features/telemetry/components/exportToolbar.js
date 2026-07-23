// ============================================================
//  features/telemetry/components/exportToolbar.js — EKSPORT PANELI
//  Reusable: XLSX / CSV / PDF tugmalari (doim sahifa YUQORISIDA).
//  Kutubxonalar (xlsx, jspdf) FAQAT bosilganda dynamic-import
//  bo'ladi — asosiy bundle og'irlashmaydi. Ma'lumot chaqiruvchi
//  tomonidan getSheets() orqali beriladi va HECH QAYERDA
//  QISQARTIRILMAYDI: barcha qatorlar eksport qilinadi, PDF
//  autoTable bilan avtomatik ko'p sahifaga bo'linadi.
// ============================================================

import { el } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { toast } from '../../../shared/toast.js';
import { slButton } from '../../../design-system/index.js';

function dl(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/**
 * @param {object} p
 * @param {Function} p.getSheets — () => [{name, rows:[{col:val,...}]}]
 *        (birinchi varaq — asosiy jadval; barchasi TO'LIQ eksport qilinadi)
 * @param {Function} [p.getTitle] — () => 'SmartLake — ...' (PDF sarlavhasi)
 * @param {Function} [p.getFileBase] — () => 'smartlake-tarix-bugun'
 */
export function buildExportToolbar({ getSheets, getTitle, getFileBase } = {}) {
  const base = () => (getFileBase ? getFileBase() : 'smartlake-export');
  const nonEmpty = () => {
    const sheets = (getSheets ? getSheets() : []).filter((sh) => sh.rows && sh.rows.length);
    if (!sheets.length) { toast(t('hist.noExport'), 'err'); return null; }
    return sheets;
  };

  async function exportCSV() {
    const sheets = nonEmpty(); if (!sheets) return;
    const lines = [];
    sheets.forEach((sh, i) => {
      if (i > 0) lines.push('', sh.name);
      const head = Object.keys(sh.rows[0]);
      lines.push(head.join(';'));
      sh.rows.forEach((r) => lines.push(head.map((h) => r[h]).join(';')));   // BARCHA qatorlar
    });
    dl(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${base()}.csv`);
  }
  async function exportXLSX() {
    const sheets = nonEmpty(); if (!sheets) return;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      sheets.forEach((sh) => XLSX.utils.book_append_sheet(
        wb, XLSX.utils.json_to_sheet(sh.rows), sh.name.slice(0, 31)));       // BARCHA qatorlar
      XLSX.writeFile(wb, `${base()}.xlsx`);
    } catch (e) { toast('XLSX: ' + (e && e.message), 'err'); }
  }
  async function exportPDF() {
    const sheets = nonEmpty(); if (!sheets) return;
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const docPdf = new jsPDF();
      docPdf.setFontSize(13);
      docPdf.text(getTitle ? getTitle() : 'SmartLake', 14, 14);
      let first = true;
      sheets.forEach((sh) => {
        const startY = first ? 20 : (docPdf.lastAutoTable ? docPdf.lastAutoTable.finalY + 10 : 20);
        if (!first) { docPdf.setFontSize(11); docPdf.text(sh.name, 14, startY - 3); }
        autoTable(docPdf, {
          head: [Object.keys(sh.rows[0])],
          body: sh.rows.map((r) => Object.values(r)),                        // BARCHA qatorlar,
          startY, styles: { fontSize: 7 },                                   // ko'p sahifaga avto bo'linadi
          headStyles: { fillColor: [14, 124, 107] },
        });
        first = false;
      });
      docPdf.save(`${base()}.pdf`);
    } catch (e) { toast('PDF: ' + (e && e.message), 'err'); }
  }

  return el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2);flex-wrap:wrap' }, [
    slButton({ label: 'Excel (.xlsx)', icon: 'download', variant: 'primary', size: 'sm', onClick: exportXLSX }),
    slButton({ label: 'CSV', variant: 'outlined', size: 'sm', onClick: exportCSV }),
    slButton({ label: 'PDF', variant: 'outlined', size: 'sm', onClick: exportPDF }),
  ]);
}

export default { buildExportToolbar };
