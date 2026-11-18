import { jsPDF } from 'jspdf';
import type { CompanyProfile, EmployeeContract } from '../types';
import { formatIdr, formatLongDateId } from './formatters';

export function generateContractPdf(
  contract: EmployeeContract,
  company: CompanyProfile
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 20;

  let y = 16;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > bottomLimit) {
      doc.addPage();
      y = 20;
    }
  };

  const writeWrapped = (
    text: string,
    x: number,
    maxWidth: number,
    lineHeight = 5,
    fontStyle: 'normal' | 'bold' | 'italic' = 'normal',
    fontSize = 9.5,
    color: [number, number, number] = [30, 41, 59]
  ) => {
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(lineHeight + 1);
      doc.text(line, x, y);
      y += lineHeight;
    }
  };

  // --- Kop Surat Perusahaan (Official Letterhead) ---
  let headerTextX = margin;
  if (company.logoDataUrl && company.logoDataUrl.startsWith('data:image/')) {
    try {
      const format = company.logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(company.logoDataUrl, format, margin, y, 18, 18, undefined, 'FAST');
      headerTextX = margin + 22;
    } catch {
      headerTextX = margin;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text(company.name.toUpperCase(), headerTextX, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const addressLines = doc.splitTextToSize(
    company.address,
    pageWidth - margin - headerTextX
  ) as string[];
  doc.text(addressLines, headerTextX, y + 10.5);
  const contactY = y + 10.5 + addressLines.length * 4;
  doc.text(
    `Telp: ${company.phone || '—'}  |  Email: ${company.email || '—'}  |  NPWP: ${company.npwp || '—'}`,
    headerTextX,
    contactY
  );

  y = Math.max(y + 21, contactY + 4);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.7);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineWidth(0.2);
  doc.line(margin, y + 1.2, pageWidth - margin, y + 1.2);
  y += 9;

  const totalCompensation = contract.baseSalary + contract.fixedAllowance;

  if (contract.contractType === 'pkwt') {
    // --- JUDUL PKWT ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(15, 23, 42);
    doc.text('PERJANJIAN KERJA WAKTU TERTENTU (PKWT)', pageWidth / 2, y, {
      align: 'center',
    });
    y += 5.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Nomor: ${contract.contractNumber}`, pageWidth / 2, y, {
      align: 'center',
    });
    y += 8;

    writeWrapped(
      `Pada hari ini, tanggal ${formatLongDateId(contract.signedDate)} bertempat di ${contract.city}, telah dibuat dan disepakati Perjanjian Kerja Waktu Tertentu ("Perjanjian") oleh dan antara:`,
      margin,
      contentWidth
    );
    y += 3;

    // Identitas Pihak Pertama & Kedua
    const writePartyRow = (label: string, value: string) => {
      ensureSpace(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text(label, margin + 6, y);
      doc.text(':', margin + 40, y);
      doc.setTextColor(15, 23, 42);
      const valLines = doc.splitTextToSize(value || '—', contentWidth - 44) as string[];
      doc.text(valLines, margin + 43, y);
      y += Math.max(1, valLines.length) * 4.8;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('1. PIHAK PERTAMA (PERUSAHAAN)', margin, y);
    y += 5.2;
    writePartyRow('Nama Perusahaan', company.name);
    writePartyRow('Diwakili Oleh', `${contract.signerName} (${contract.signerTitle})`);
    writePartyRow('Alamat Kantor', company.address);
    writeWrapped(
      'Selanjutnya disebut sebagai PIHAK PERTAMA.',
      margin + 6,
      contentWidth - 6,
      4.8,
      'italic',
      9
    );
    y += 3;

    ensureSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('2. PIHAK KEDUA (KARYAWAN)', margin, y);
    y += 5.2;
    writePartyRow('Nama Lengkap', contract.employeeName);
    writePartyRow('NIP', contract.employeeNip);
    writePartyRow('NIK (No. KTP)', contract.employeeNik || '—');
    writePartyRow('Alamat Domisili', contract.employeeAddress || '—');
    writePartyRow('Email Aktif', contract.employeeEmail || '—');
    writeWrapped(
      'Selanjutnya disebut sebagai PIHAK KEDUA.',
      margin + 6,
      contentWidth - 6,
      4.8,
      'italic',
      9
    );
    y += 4;

    writeWrapped(
      'PIHAK PERTAMA dan PIHAK KEDUA secara bersama-sama sepakat untuk mengikatkan diri dalam hubungan kerja dengan syarat dan ketentuan sebagaimana diatur dalam pasal-pasal berikut:',
      margin,
      contentWidth
    );
    y += 3;

    const writeClause = (title: string, body: string) => {
      ensureSpace(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.8);
      doc.setTextColor(15, 23, 42);
      doc.text(title, margin, y);
      y += 5;
      writeWrapped(body, margin, contentWidth, 4.9, 'normal', 9.5);
      y += 3;
    };

    writeClause(
      'Pasal 1 — Jabatan, Departemen, dan Lokasi Kerja',
      `PIHAK PERTAMA mempekerjakan PIHAK KEDUA pada posisi ${contract.position} di Departemen ${contract.department}, dengan penempatan lokasi kerja di ${contract.workLocation}. PIHAK KEDUA bersedia melaksanakan tugas dan tanggung jawab sesuai uraian pekerjaan serta arahan pimpinan.`
    );

    const endDateLabel = contract.endDate ? formatLongDateId(contract.endDate) : '—';
    const durationLabel = contract.durationMonths ? ` (${contract.durationMonths} bulan)` : '';
    writeClause(
      'Pasal 2 — Jangka Waktu Perjanjian',
      `Perjanjian ini berlaku untuk jangka waktu tertentu terhitung sejak tanggal ${formatLongDateId(contract.startDate)} sampai dengan tanggal ${endDateLabel}${durationLabel}. Sesuai peraturan ketenagakerjaan yang berlaku (PP No. 35 Tahun 2021), PKWT ini tidak mensyaratkan masa percobaan (probation).`
    );

    writeClause(
      'Pasal 3 — Hari dan Jam Kerja',
      `PIHAK KEDUA wajib mematuhi jadwal kerja perusahaan yaitu ${contract.workingHours}, serta menaati ketentuan kehadiran, cuti tahunan, dan tata tertib yang berlaku di lingkungan ${company.name}.`
    );

    writeClause(
      'Pasal 4 — Upah dan Tunjangan',
      `Atas pelaksanaan pekerjaan tersebut, PIHAK PERTAMA memberikan kompensasi bulanan dengan rincian: Gaji Pokok sebesar ${formatIdr(contract.baseSalary)}, Tunjangan Tetap sebesar ${formatIdr(contract.fixedAllowance)}, sehingga Total Penghasilan Tetap adalah ${formatIdr(totalCompensation)} per bulan (bruto). Pembayaran dilakukan setiap akhir bulan melalui transfer bank setelah diperhitungkan pemotongan PPh 21 dan iuran BPJS sesuai ketentuan perundang-undangan.`
    );

    writeClause(
      'Pasal 5 — Kerahasiaan dan Kewajiban Karyawan',
      `PIHAK KEDUA wajib menjaga kerahasiaan seluruh data perusahaan, informasi klien, kode sumber, dokumen keuangan, serta aset intelektual milik ${company.name} selama masa perjanjian berlangsung maupun setelah berakhirnya hubungan kerja.`
    );

    writeClause(
      'Pasal 6 — Pengakhiran Perjanjian & Uang Kompensasi',
      `Perjanjian berakhir demi hukum pada tanggal ${endDateLabel}, atau dapat diperpanjang/diperbarui berdasarkan kesepakatan tertulis para pihak. Pemberian uang kompensasi PKWT dan tata cara pengakhiran sebelum masa kontrak berakhir dilaksanakan sesuai ketentuan Undang-Undang Cipta Kerja beserta peraturan pelaksananya.`
    );

    if (contract.customClauses.trim()) {
      writeClause('Pasal 7 — Ketentuan Tambahan', contract.customClauses.trim());
    }

    // Blok Tanda Tangan PKWT
    ensureSpace(44);
    y += 4;
    writeWrapped(
      `Demikian Perjanjian Kerja Waktu Tertentu ini dibuat dalam rangkap 2 (dua) bermeterai cukup dan ditandatangani oleh kedua belah pihak dalam keadaan sadar tanpa paksaan.`,
      margin,
      contentWidth
    );
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${contract.city}, ${formatLongDateId(contract.signedDate)}`, margin, y);
    y += 7;

    const leftX = margin;
    const rightX = pageWidth / 2 + 12;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('PIHAK PERTAMA,', leftX, y);
    doc.text('PIHAK KEDUA,', rightX, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(company.name, leftX, y);
    doc.text('Karyawan yang Bersangkutan', rightX, y);

    y += 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(contract.signerName, leftX, y);
    doc.text(contract.employeeName, rightX, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(contract.signerTitle, leftX, y);
    doc.text(`NIP: ${contract.employeeNip}`, rightX, y);
  } else {
    // --- SK PENGANGKATAN KARYAWAN TETAP (PKWTT) ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(15, 23, 42);
    doc.text('SURAT KEPUTUSAN PENGANGKATAN KARYAWAN TETAP', pageWidth / 2, y, {
      align: 'center',
    });
    y += 5.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Nomor: ${contract.contractNumber}`, pageWidth / 2, y, {
      align: 'center',
    });
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`TENTANG PENGANGKATAN KARYAWAN TETAP (PKWTT)`, pageWidth / 2, y, {
      align: 'center',
    });
    y += 8;

    const writeSectionList = (heading: string, paragraphs: string[]) => {
      ensureSpace(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(heading, margin, y);
      y += 5;
      for (const p of paragraphs) {
        writeWrapped(p, margin + 4, contentWidth - 4, 4.9, 'normal', 9.5);
        y += 1.5;
      }
      y += 2;
    };

    writeSectionList('MENIMBANG :', [
      `a. Bahwa untuk mendukung kelancaran operasional dan pertumbuhan bisnis ${company.name}, diperlukan penetapan status kepegawaian yang profesional dan berkesinambungan.`,
      `b. Bahwa Saudara/i ${contract.employeeName} dinilai memiliki kompetensi, integritas, dan kinerja yang memenuhi standar perusahaan untuk diangkat sebagai Karyawan Tetap.`,
    ]);

    writeSectionList('MENGINGAT :', [
      `1. Undang-Undang Ketenagakerjaan Republik Indonesia beserta perubahannya dalam UU Cipta Kerja dan Peraturan Pemerintah terkait Perjanjian Kerja Waktu Tidak Tertentu (PKWTT).`,
      `2. Peraturan Perusahaan dan Ketentuan Tata Kelola Sumber Daya Manusia ${company.name}.`,
    ]);

    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('MEMUTUSKAN / MENETAPKAN', pageWidth / 2, y, { align: 'center' });
    y += 7;

    const writeDecreeRow = (label: string, value: string) => {
      ensureSpace(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text(label, margin + 6, y);
      doc.text(':', margin + 44, y);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      const valLines = doc.splitTextToSize(value || '—', contentWidth - 48) as string[];
      doc.text(valLines, margin + 47, y);
      y += Math.max(1, valLines.length) * 4.8;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('KESATU', margin, y);
    y += 5;
    writeWrapped(
      `Terhitung mulai tanggal ${formatLongDateId(contract.startDate)}, mengangkat nama di bawah ini sebagai Karyawan Tetap (PKWTT) pada ${company.name}:`,
      margin + 4,
      contentWidth - 4
    );
    y += 2;
    writeDecreeRow('Nama Lengkap', contract.employeeName);
    writeDecreeRow('NIP', contract.employeeNip);
    writeDecreeRow('NIK (No. KTP)', contract.employeeNik || '—');
    writeDecreeRow('Alamat Domisili', contract.employeeAddress || '—');
    writeDecreeRow('Jabatan', contract.position);
    writeDecreeRow('Departemen / Divisi', contract.department);
    writeDecreeRow('Lokasi Penempatan', contract.workLocation);
    y += 3;

    const probationText =
      contract.probationMonths > 0
        ? `Pengangkatan ini disertai masa percobaan (probation) selama ${contract.probationMonths} bulan sejak tanggal efektif berlaku. Evaluasi kinerja dilaksanakan sebelum masa percobaan berakhir.`
        : `Karyawan ditetapkan langsung sebagai Karyawan Tetap tanpa masa percobaan tambahan, dengan jadwal kerja ${contract.workingHours}.`;

    writeSectionList('KEDUA', [probationText]);

    writeSectionList('KETIGA', [
      `Karyawan yang bersangkutan berhak atas paket kompensasi bulanan dengan Gaji Pokok sebesar ${formatIdr(contract.baseSalary)} dan Tunjangan Tetap sebesar ${formatIdr(contract.fixedAllowance)} (Total Penghasilan Tetap ${formatIdr(totalCompensation)}/bulan bruto), beserta hak cuti tahunan dan jaminan sosial BPJS sesuai ketentuan perusahaan.`,
    ]);

    if (contract.customClauses.trim()) {
      writeSectionList('KEEMPAT', [contract.customClauses.trim()]);
    }

    writeSectionList(contract.customClauses.trim() ? 'KELIMA' : 'KEEMPAT', [
      `Surat Keputusan ini berlaku sejak tanggal ditetapkan. Apabila di kemudian hari terdapat kekeliruan dalam penetapan ini, akan dilakukan perbaikan sebagaimana mestinya.`,
    ]);

    // Blok Pengesahan & Tanda Tangan
    ensureSpace(44);
    y += 4;
    const signX = pageWidth - margin - 66;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Ditetapkan di : ${contract.city}`, signX, y);
    y += 5;
    doc.text(`Pada tanggal  : ${formatLongDateId(contract.signedDate)}`, signX, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(company.name, signX, y);
    y += 22;
    doc.text(contract.signerName, signX, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(contract.signerTitle, signX, y);

    // Tembusan kiri bawah
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Tembusan:', margin, y - 16);
    doc.setFont('helvetica', 'normal');
    doc.text('1. Karyawan yang bersangkutan', margin, y - 11.5);
    doc.text('2. Divisi Keuangan & Payroll', margin, y - 7.5);
    doc.text('3. Arsip HRD', margin, y - 3.5);
  }

  // Footer pagination on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${company.name} · ${contract.contractNumber} · Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  const safeFilename = contract.contractNumber.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const prefix = contract.contractType === 'pkwt' ? 'PKWT' : 'SK_Pengangkatan';
  doc.save(`${prefix}_${safeFilename}.pdf`);
}
