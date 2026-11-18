# FakturaFlow Enterprise

Platform operasional keuangan dan HR perusahaan berbasis web untuk manajemen faktur & penagihan otomatis Midtrans, akuntansi kas kantor, penggajian PPh 21 TER (PP 58/2023) & BPJS, pengajuan cuti karyawan, serta kontrol hak akses berbasis peran (RBAC).

---

## Fitur Utama

- **Faktur & Jadwal Bulanan**: Pembuatan faktur, ekspor PDF, penjadwalan penagihan otomatis bulanan, dan pengiriman email via SMTP.
- **Integrasi Midtrans**: Pembayaran online via Midtrans Snap (QRIS, Virtual Account, GoPay, Kartu) dengan verifikasi webhook SHA-512 dan notifikasi push real-time.
- **Akuntansi Kantor**: Pencatatan kas masuk/keluar, rekonsiliasi transaksi, sinkronisasi pelunasan faktur & pembayaran gaji, serta ringkasan arus kas dan laba rugi.
- **Penggajian (Payroll) Sesuai Peraturan Indonesia**:
  - **PPh 21 TER Bulanan** (PP 58/2023 & PMK 168/2023) untuk kategori TER A, B, dan C berdasarkan status PTKP (`TK/0`–`K/3`).
  - **Rekonsiliasi Akhir Tahun Pasal 17 UU HPP** otomatis pada periode Desember.
  - **BPJS Kesehatan (Perpres 64/2020)** & **BPJS Ketenagakerjaan (PP 44–46/2015)** (JHT, JP, JKK, JKM) beserta slip gaji PDF & email.
- **Cuti & Hak Akses (RBAC)**: Pengajuan/persetujuan cuti, kuota cuti tahunan, serta pembagian akses **Admin**, **Manager**, **HRD**, dan **User / Staf**.

---

## Akun Login Awal

Pada database awal yang terisi, akun berikut aktif digunakan:

| Role | Username | Email | Kata Sandi Awal |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin@nusantarakarya.co.id` | `Password123!` |
| **Manager** | `manager` | `manager@nusantarakarya.co.id` | `Password123!` |
| **HRD** | `hrd` | `hrd@nusantarakarya.co.id` | `Password123!` |
| **User / Staf** | `user` | `user@nusantarakarya.co.id` | `Password123!` |

> **Deploy Produksi Baru (`NODE_ENV=production`)**:
> Jika dijalankan pada database kosong, sistem tidak membuat data sampel (faktur, klien, karyawan, atau transaksi contoh) dan hanya membuat akun **Admin** awal (`admin` / `admin@nusantarakarya.co.id`) dengan kata sandi dari variabel `INITIAL_ADMIN_PASSWORD` (default `Password123!` bila tidak diatur).
>
> **Keamanan**: Segera ganti kata sandi akun awal setelah masuk melalui menu **Hak Akses & User**, dan nonaktifkan/hapus akun yang tidak diperlukan.

---

## Menjalankan Aplikasi

### Development
```bash
npm install
npm run dev
```
Server berjalan di `http://localhost:3000`.

### Production
```bash
npm install
npm run build
npm start
```
(`npm start` menjalankan `NODE_ENV=production tsx server.ts` pada port `3000` atau `PORT` yang dikonfigurasi.)

### Pemeriksaan TypeScript
```bash
npm run lint
```

---

## Variabel Lingkungan (`.env`)

Salin `.env.example` menjadi `.env` jika ingin menyetel konfigurasi awal melalui environment:

```env
APP_URL="https://domain-anda.co.id"
INITIAL_ADMIN_PASSWORD="kata-sandi-admin-yang-kuat"

# Opsional: kredensial Midtrans & SMTP (juga dapat diatur dari menu Pengaturan di UI)
MIDTRANS_MERCHANT_ID=""
MIDTRANS_CLIENT_KEY=""
MIDTRANS_SERVER_KEY=""
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
```

---

## Checklist Konfigurasi Produksi

1. Masuk sebagai **Admin**, lalu ubah kata sandi default di menu **Hak Akses & User**.
2. Buka menu **Pengaturan**:
   - **Profil Perusahaan**: Lengkapi nama, alamat, NPWP, logo, dan rekening bank perusahaan.
   - **Midtrans API**: Ubah mode ke **Production (Live)**, isi `Merchant ID`, `Client Key`, dan `Server Key`, lalu tempel **Webhook URL** (`https://<domain>/api/midtrans/webhook`) ke Midtrans Dashboard.
   - **Email SMTP**: Isi host, port, username, dan password SMTP agar pengiriman faktur & slip gaji berjalan langsung.
3. Lakukan backup berkala pada file database SQLite di `data/fakturaflow.db`.
