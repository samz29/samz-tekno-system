import type { PtkpStatus, TerCategory } from '../types';

export const BPJS_KES_WAGE_CAP = 12_000_000; // Perpres No. 64 Tahun 2020
export const BPJS_JP_WAGE_CAP = 10_547_400; // Batas upah Jaminan Pensiun BPJS TK (penyesuaian 2025/2026)
export const DEFAULT_JKK_RATE = 0.0024; // 0,24% (Tingkat Risiko Sangat Rendah - Perkantoran/IT)
export const BPJS_JKM_RATE = 0.003; // 0,30%

export interface PtkpMeta {
  code: PtkpStatus;
  label: string;
  annualAmount: number;
  terCategory: TerCategory;
}

export const PTKP_META: Record<PtkpStatus, PtkpMeta> = {
  'TK/0': { code: 'TK/0', label: 'TK/0 — Tidak Kawin, 0 Tanggungan', annualAmount: 54_000_000, terCategory: 'A' },
  'TK/1': { code: 'TK/1', label: 'TK/1 — Tidak Kawin, 1 Tanggungan', annualAmount: 58_500_000, terCategory: 'A' },
  'TK/2': { code: 'TK/2', label: 'TK/2 — Tidak Kawin, 2 Tanggungan', annualAmount: 63_000_000, terCategory: 'B' },
  'TK/3': { code: 'TK/3', label: 'TK/3 — Tidak Kawin, 3 Tanggungan', annualAmount: 67_500_000, terCategory: 'B' },
  'K/0': { code: 'K/0', label: 'K/0 — Kawin, 0 Tanggungan', annualAmount: 58_500_000, terCategory: 'A' },
  'K/1': { code: 'K/1', label: 'K/1 — Kawin, 1 Tanggungan', annualAmount: 63_000_000, terCategory: 'B' },
  'K/2': { code: 'K/2', label: 'K/2 — Kawin, 2 Tanggungan', annualAmount: 67_500_000, terCategory: 'B' },
  'K/3': { code: 'K/3', label: 'K/3 — Kawin, 3 Tanggungan', annualAmount: 72_000_000, terCategory: 'C' },
};

export const PTKP_LIST: PtkpMeta[] = Object.values(PTKP_META);

// Lampiran PP Nomor 58 Tahun 2023 — Tarif Efektif Rata-Rata (TER) Bulanan
// Format: [batasAtasBrutoInklusif, tarifPersen]
type TerBracket = [number, number];

const TER_CATEGORY_A: TerBracket[] = [
  [5_400_000, 0],
  [5_650_000, 0.25],
  [5_950_000, 0.5],
  [6_300_000, 0.75],
  [6_750_000, 1],
  [7_500_000, 1.25],
  [8_550_000, 1.5],
  [9_650_000, 1.75],
  [10_050_000, 2],
  [10_350_000, 2.25],
  [10_700_000, 2.5],
  [11_050_000, 3],
  [11_600_000, 3.5],
  [12_500_000, 4],
  [13_750_000, 5],
  [15_100_000, 6],
  [16_950_000, 7],
  [19_750_000, 8],
  [24_150_000, 9],
  [26_450_000, 10],
  [28_000_000, 11],
  [30_050_000, 12],
  [32_400_000, 13],
  [35_400_000, 14],
  [39_100_000, 15],
  [43_850_000, 16],
  [47_800_000, 17],
  [51_400_000, 18],
  [56_300_000, 19],
  [62_200_000, 20],
  [68_600_000, 21],
  [77_500_000, 22],
  [89_000_000, 23],
  [103_000_000, 24],
  [125_000_000, 25],
  [157_000_000, 26],
  [206_000_000, 27],
  [337_000_000, 28],
  [454_000_000, 29],
  [550_000_000, 30],
  [695_000_000, 31],
  [910_000_000, 32],
  [1_400_000_000, 33],
  [Number.POSITIVE_INFINITY, 34],
];

const TER_CATEGORY_B: TerBracket[] = [
  [6_200_000, 0],
  [6_500_000, 0.25],
  [6_850_000, 0.5],
  [7_300_000, 0.75],
  [9_200_000, 1],
  [10_750_000, 1.5],
  [11_250_000, 2],
  [11_600_000, 2.5],
  [12_600_000, 3],
  [13_600_000, 4],
  [14_950_000, 5],
  [16_400_000, 6],
  [18_450_000, 7],
  [21_850_000, 8],
  [26_000_000, 9],
  [27_700_000, 10],
  [29_350_000, 11],
  [31_450_000, 12],
  [33_950_000, 13],
  [37_100_000, 14],
  [41_100_000, 15],
  [45_800_000, 16],
  [49_500_000, 17],
  [53_800_000, 18],
  [58_500_000, 19],
  [64_000_000, 20],
  [71_000_000, 21],
  [80_000_000, 22],
  [93_000_000, 23],
  [109_000_000, 24],
  [129_000_000, 25],
  [163_000_000, 26],
  [211_000_000, 27],
  [374_000_000, 28],
  [459_000_000, 29],
  [555_000_000, 30],
  [704_000_000, 31],
  [957_000_000, 32],
  [1_405_000_000, 33],
  [Number.POSITIVE_INFINITY, 34],
];

const TER_CATEGORY_C: TerBracket[] = [
  [6_600_000, 0],
  [6_950_000, 0.25],
  [7_350_000, 0.5],
  [7_800_000, 0.75],
  [8_850_000, 1],
  [9_800_000, 1.25],
  [10_950_000, 1.5],
  [11_200_000, 1.75],
  [12_050_000, 2],
  [12_950_000, 3],
  [14_150_000, 4],
  [15_550_000, 5],
  [17_050_000, 6],
  [19_500_000, 7],
  [22_700_000, 8],
  [26_600_000, 9],
  [28_100_000, 10],
  [30_100_000, 11],
  [32_600_000, 12],
  [35_400_000, 13],
  [38_900_000, 14],
  [43_000_000, 15],
  [47_400_000, 16],
  [51_200_000, 17],
  [55_800_000, 18],
  [60_400_000, 19],
  [66_700_000, 20],
  [74_500_000, 21],
  [83_200_000, 22],
  [95_600_000, 23],
  [110_500_000, 24],
  [134_000_000, 25],
  [169_000_000, 26],
  [222_000_000, 27],
  [390_000_000, 28],
  [463_000_000, 29],
  [561_000_000, 30],
  [709_000_000, 31],
  [965_000_000, 32],
  [1_419_000_000, 33],
  [Number.POSITIVE_INFINITY, 34],
];

export function getTerCategory(ptkpStatus: PtkpStatus): TerCategory {
  return (PTKP_META[ptkpStatus] || PTKP_META['TK/0']).terCategory;
}

export function lookupTerRatePercent(category: TerCategory, taxableGross: number): number {
  if (taxableGross <= 0) return 0;
  const table =
    category === 'A' ? TER_CATEGORY_A : category === 'B' ? TER_CATEGORY_B : TER_CATEGORY_C;
  for (const [upperBound, rate] of table) {
    if (taxableGross <= upperBound) {
      return rate;
    }
  }
  return 34;
}

export function calculateAnnualPasal17Tax(pkp: number): number {
  const roundedPkp = Math.max(0, Math.floor(pkp / 1000) * 1000);
  if (roundedPkp === 0) return 0;

  let remaining = roundedPkp;
  let tax = 0;

  const layers: Array<[number, number]> = [
    [60_000_000, 0.05],
    [190_000_000, 0.15], // 60jt s.d. 250jt
    [250_000_000, 0.25], // 250jt s.d. 500jt
    [4_500_000_000, 0.3], // 500jt s.d. 5M
    [Number.POSITIVE_INFINITY, 0.35], // > 5M
  ];

  for (const [layerCap, rate] of layers) {
    if (remaining <= 0) break;
    const chunk = Math.min(remaining, layerCap);
    tax += chunk * rate;
    remaining -= chunk;
  }

  return Math.round(tax);
}

export interface StatutoryPayrollInput {
  baseSalary: number;
  allowances: number;
  overtimePay?: number;
  bonus?: number;
  ptkpStatus?: PtkpStatus;
  bpjsEnrolled?: boolean;
  jkkRate?: number;
}

export interface StatutoryPayrollResult {
  ptkpStatus: PtkpStatus;
  terCategory: TerCategory;
  fixedWage: number;
  grossCashPay: number;
  bpjsKesEmployee: number;
  bpjsJhtEmployee: number;
  bpjsJpEmployee: number;
  bpjsDeduction: number;
  bpjsKesEmployer: number;
  bpjsJhtEmployer: number;
  bpjsJpEmployer: number;
  bpjsJkkEmployer: number;
  bpjsJkmEmployer: number;
  bpjsEmployerTotal: number;
  pph21TaxableGross: number;
  pph21Rate: number;
  pph21Deduction: number;
}

export function calculateIndonesianPayrollTaxes(
  input: StatutoryPayrollInput
): StatutoryPayrollResult {
  const baseSalary = Math.max(0, Math.round(Number(input.baseSalary || 0)));
  const allowances = Math.max(0, Math.round(Number(input.allowances || 0)));
  const overtimePay = Math.max(0, Math.round(Number(input.overtimePay || 0)));
  const bonus = Math.max(0, Math.round(Number(input.bonus || 0)));

  const ptkpStatus: PtkpStatus =
    input.ptkpStatus && input.ptkpStatus in PTKP_META ? input.ptkpStatus : 'TK/0';
  const terCategory = getTerCategory(ptkpStatus);
  const bpjsEnrolled = input.bpjsEnrolled !== false;
  const jkkRate = typeof input.jkkRate === 'number' ? input.jkkRate : DEFAULT_JKK_RATE;

  const fixedWage = baseSalary + allowances;
  const grossCashPay = fixedWage + overtimePay + bonus;

  // 1. BPJS Kesehatan & Ketenagakerjaan (berdasarkan Gaji Pokok + Tunjangan Tetap)
  let bpjsKesEmployee = 0;
  let bpjsJhtEmployee = 0;
  let bpjsJpEmployee = 0;
  let bpjsKesEmployer = 0;
  let bpjsJhtEmployer = 0;
  let bpjsJpEmployer = 0;
  let bpjsJkkEmployer = 0;
  let bpjsJkmEmployer = 0;

  if (bpjsEnrolled && fixedWage > 0) {
    const kesBase = Math.min(fixedWage, BPJS_KES_WAGE_CAP);
    bpjsKesEmployee = Math.round(kesBase * 0.01);
    bpjsKesEmployer = Math.round(kesBase * 0.04);

    bpjsJhtEmployee = Math.round(fixedWage * 0.02);
    bpjsJhtEmployer = Math.round(fixedWage * 0.037);

    const jpBase = Math.min(fixedWage, BPJS_JP_WAGE_CAP);
    bpjsJpEmployee = Math.round(jpBase * 0.01);
    bpjsJpEmployer = Math.round(jpBase * 0.02);

    bpjsJkkEmployer = Math.round(fixedWage * jkkRate);
    bpjsJkmEmployer = Math.round(fixedWage * BPJS_JKM_RATE);
  }

  const bpjsDeduction = bpjsKesEmployee + bpjsJhtEmployee + bpjsJpEmployee;
  const bpjsEmployerTotal =
    bpjsKesEmployer + bpjsJhtEmployer + bpjsJpEmployer + bpjsJkkEmployer + bpjsJkmEmployer;

  // 2. Penghasilan Bruto Objek PPh 21 (PMK 168/2023):
  // Gaji + Tunjangan + Lembur + Bonus + Premi BPJS Kes (4%), JKK, JKM dibayar perusahaan
  const pph21TaxableGross = grossCashPay + bpjsKesEmployer + bpjsJkkEmployer + bpjsJkmEmployer;
  const pph21Rate = lookupTerRatePercent(terCategory, pph21TaxableGross);
  const pph21Deduction = Math.round(pph21TaxableGross * (pph21Rate / 100));

  return {
    ptkpStatus,
    terCategory,
    fixedWage,
    grossCashPay,
    bpjsKesEmployee,
    bpjsJhtEmployee,
    bpjsJpEmployee,
    bpjsDeduction,
    bpjsKesEmployer,
    bpjsJhtEmployer,
    bpjsJpEmployer,
    bpjsJkkEmployer,
    bpjsJkmEmployer,
    bpjsEmployerTotal,
    pph21TaxableGross,
    pph21Rate,
    pph21Deduction,
  };
}

export function calculateDecemberPasal17Reconciliation(params: {
  ptkpStatus: PtkpStatus;
  priorMonthsCount: number; // e.g., slips in Jan-Nov
  priorTaxableGrossTotal: number;
  priorEmployeeRetirementContribTotal: number; // JHT 2% + JP 1%
  priorPph21WithheldTotal: number;
  decemberTaxableGross: number;
  decemberEmployeeRetirementContrib: number; // JHT 2% + JP 1%
}): {
  annualTaxableGross: number;
  biayaJabatan: number;
  annualRetirementContrib: number;
  annualNetIncome: number;
  annualPtkp: number;
  pkp: number;
  annualPph21: number;
  decemberPph21: number;
  monthsWorked: number;
} {
  const ptkpMeta = PTKP_META[params.ptkpStatus] || PTKP_META['TK/0'];
  const monthsWorked = Math.max(1, Math.min(12, params.priorMonthsCount + 1));
  const annualTaxableGross = params.priorTaxableGrossTotal + params.decemberTaxableGross;

  // Biaya Jabatan: 5% dari penghasilan bruto, maks Rp 500.000/bulan bekerja (maks Rp 6.000.000/tahun)
  const biayaJabatanCap = monthsWorked * 500_000;
  const biayaJabatan = Math.min(Math.round(annualTaxableGross * 0.05), biayaJabatanCap);

  const annualRetirementContrib =
    params.priorEmployeeRetirementContribTotal + params.decemberEmployeeRetirementContrib;
  const annualNetIncome = Math.max(
    0,
    annualTaxableGross - biayaJabatan - annualRetirementContrib
  );
  const annualPtkp = ptkpMeta.annualAmount;
  const pkp = Math.max(0, annualNetIncome - annualPtkp);
  const annualPph21 = calculateAnnualPasal17Tax(pkp);
  const decemberPph21 = Math.max(0, annualPph21 - params.priorPph21WithheldTotal);

  return {
    annualTaxableGross,
    biayaJabatan,
    annualRetirementContrib,
    annualNetIncome,
    annualPtkp,
    pkp,
    annualPph21,
    decemberPph21,
    monthsWorked,
  };
}
