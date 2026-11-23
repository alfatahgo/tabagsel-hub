// ============================================================
// TABAGSEL HUB - Konfigurasi Terpusat
// Platform Managed Brokerage Properti, Otomotif & Jasa Tabagsel
// ============================================================

const CONFIG = {
  // Supabase
  SUPABASE_URL: 'https://kxtmaticddpbthtcpjpw.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_ILyh8iQ3kRoDSwtZpyuzRA_SlJmzf2r',

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: 'nxdgaaoh',
  CLOUDINARY_UPLOAD_PRESET: 'tabagsel_unsigned',

  // Cloudinary Folder Structure
  CLOUDINARY_FOLDERS: {
    KATALOG_PROPERTI: 'tabagsel-hub/katalog/properti',
    KATALOG_OTOMOTIF: 'tabagsel-hub/katalog/otomotif',
    KATALOG_JASA: 'tabagsel-hub/katalog/jasa',
    BUKTI_PEMBAYARAN: 'tabagsel-hub/bukti-pembayaran',
    IDENTITAS_SEWA: 'tabagsel-hub/identitas-sewa',
    LAPORAN_SURVEYOR: 'tabagsel-hub/laporan-surveyor',
    LAPORAN_MITRA: 'tabagsel-hub/laporan-mitra',
  },

  // Admin Pusat WhatsApp & Contact
  ADMIN_WHATSAPP: '62811646646',
  WA_ADMIN: {
    PADANGSIDIMPUAN: '62811646646',
    TAPSEL: '62811646646',
    PALUTA: '62811646646',
    PALAS: '62811646646',
    MADINA: '62811646646',
  },
  ADMIN_EMAIL: 'info@tabagselhub.id',
  ADMIN_LOCATION: 'Padangsidimpuan, Tapanuli Selatan',

  // Tarif Biaya Survei per Kabupaten (dalam Rupiah)
  TARIF_SURVEI: {
    'Kota Padangsidimpuan': 150000,
    'Tapanuli Selatan': 200000,
    'Mandailing Natal': 250000,
    'Padang Lawas': 300000,
    'Padang Lawas Utara': 300000,
  },

  // Tarif Jasa Wakili Survei
  TARIF_JASA_SURVEI: {
    REGULER: 350000,
    VIP: 600000,
  },

  // Daftar Wilayah Tabagsel
  WILAYAH: [
    'Kota Padangsidimpuan',
    'Tapanuli Selatan',
    'Mandailing Natal',
    'Padang Lawas',
    'Padang Lawas Utara',
  ],

  // 8 Ikon Layanan Cepat (Floating Grid Putih)
  QUICK_SERVICES: [
    {
      id: 'quick-properti',
      title: 'Properti & Lahan',
      sub: 'Jual Beli • Sewa',
      icon: 'home',
      kategori: 'PROPERTI',
    },
    {
      id: 'quick-otomotif',
      title: 'Otomotif & Alat Usaha',
      sub: 'Mobil, Motor & Truk',
      icon: 'car',
      kategori: 'OTOMOTIF',
    },
    {
      id: 'quick-inspeksi',
      title: 'Jasa Inspeksi',
      sub: 'Cek Mesin & Rangka',
      icon: 'search-check',
      kategori: 'JASA_SERVIS',
      subKategori: 'Jasa Inspeksi Mobil & Motor Bekas',
    },
    {
      id: 'quick-drone',
      title: 'Pemetaan & Drone',
      sub: 'Ukur Lahan & Patok',
      icon: 'map-pin',
      kategori: 'JASA_SERVIS',
      subKategori: 'Jasa Pengukuran Lahan, Pasang Patok & Pemetaan Drone',
    },
    {
      id: 'quick-land-clearing',
      title: 'Land Clearing & Kebun',
      sub: 'Kelola Kebun Jarak Jauh',
      icon: 'trees',
      kategori: 'JASA_SERVIS',
      subKategori: 'Jasa Land Clearing & Pengelolaan Kebun Jarak Jauh',
    },
    {
      id: 'quick-legalitas',
      title: 'Biro Legalitas',
      sub: 'SHM, SK Camat, BPKB/STNK',
      icon: 'file-text',
      kategori: 'JASA_SERVIS',
      subKategori: 'Biro Jasa Pengurusan Surat Kendaraan & Legalitas Tanah',
    },
    {
      id: 'quick-kontraktor',
      title: 'Kontraktor & Renovasi',
      sub: 'Bangun & Kanopi',
      icon: 'tool',
      kategori: 'JASA_SERVIS',
      subKategori: 'Jasa Kontraktor Renovasi, Kanopi & Borongan Bangunan',
    },
    {
      id: 'quick-servis-panggilan',
      title: 'Jasa Servis Panggilan',
      sub: 'AC, Derek, IT/CCTV',
      icon: 'settings',
      kategori: 'JASA_SERVIS',
      subKategori: 'Servis & Cuci AC, Kulkas, Mesin Cuci',
    },
  ],

  // Struktur Bidang & Sub-Bidang Baku
  KATEGORI: {
    PROPERTI: {
      label: 'Properti & Lahan',
      prefix: 'TH-PRP',
      sub: [
        { value: 'Rumah Tinggal', label: 'Rumah Tinggal' },
        { value: 'Ruko & Tempat Usaha', label: 'Ruko & Tempat Usaha' },
        { value: 'Tanah Kavling', label: 'Tanah Kavling' },
        { value: 'Lahan Perkebunan & Pertanian', label: 'Lahan Perkebunan & Pertanian' },
        { value: 'Gudang & Lahan Industri', label: 'Gudang & Lahan Industri' },
      ],
    },
    OTOMOTIF: {
      label: 'Otomotif & Alat Usaha',
      prefix: 'TH-OTO',
      sub: [
        { value: 'Mobil Pribadi', label: 'Mobil Pribadi' },
        { value: 'Sepeda Motor', label: 'Sepeda Motor' },
        { value: 'Mobil Niaga & Truk Material', label: 'Mobil Niaga & Truk Material' },
        { value: 'Mesin Pertanian & Alat Berat', label: 'Mesin Pertanian & Alat Berat' },
      ],
    },
    JASA_SERVIS: {
      label: 'Jasa & Servis Terverifikasi',
      prefix: 'TH-JSA',
      sub: [
        { value: 'Jasa Inspeksi Mobil & Motor Bekas', label: 'Jasa Inspeksi Mobil & Motor Bekas' },
        { value: 'Jasa Pengukuran Lahan, Pasang Patok & Pemetaan Drone', label: 'Jasa Pengukuran Lahan, Pasang Patok & Pemetaan Drone' },
        { value: 'Jasa Land Clearing & Pengelolaan Kebun Jarak Jauh', label: 'Jasa Land Clearing & Pengelolaan Kebun Jarak Jauh' },
        { value: 'Biro Jasa Pengurusan Surat Kendaraan & Legalitas Tanah', label: 'Biro Jasa Pengurusan Surat Kendaraan & Legalitas Tanah' },
        { value: 'Jasa Kontraktor Renovasi, Kanopi & Borongan Bangunan', label: 'Jasa Kontraktor Renovasi, Kanopi & Borongan Bangunan' },
        { value: 'Servis & Cuci AC, Kulkas, Mesin Cuci', label: 'Servis & Cuci AC, Kulkas, Mesin Cuci' },
        { value: 'Mekanik Mobil/Motor Panggilan & Derek Darurat', label: 'Mekanik Mobil/Motor Panggilan & Derek Darurat' },
        { value: 'Servis IT, CCTV, Komputer, Printer & Kelistrikan', label: 'Servis IT, CCTV, Komputer, Printer & Kelistrikan' },
      ],
    },
  },

  // Status Aset
  STATUS_ASET: ['Tersedia', 'Negosiasi', 'Terjual/Tersewa'],

  // Pipeline CRM Stages
  CRM_STAGES: [
    { key: 'lead', label: '1. Lead & Verifikasi Bayar Survei' },
    { key: 'jadwal', label: '2. Jadwal Survei Lapangan/Virtual' },
    { key: 'negosiasi', label: '3. Proses Negosiasi' },
    { key: 'eksekusi', label: '4. Siap Eksekusi / Pertemuan Akhir' },
    { key: 'closing', label: '5. Closing / Batal' },
  ],

  // Status Pengerjaan Mitra Rekanan
  STATUS_PENGERJAAN_MITRA: [
    { key: 'menunggu', label: 'Menunggu Penugasan' },
    { key: 'diteruskan', label: 'Diteruskan ke Mitra' },
    { key: 'proses', label: 'Sedang Dikerjakan' },
    { key: 'selesai', label: 'Selesai & Fee Cair' },
  ],

  // Rekening Pembayaran Resmi
  REKENING: {
    bank: 'Bank Sumut',
    nomor: '1234567890',
    atas_nama: 'TABAGSEL HUB',
  },
};

// Helper: Format Rupiah
function formatRupiah(angka) {
  if (angka === null || angka === undefined || isNaN(angka)) return 'Rp 0';
  return 'Rp ' + Number(angka).toLocaleString('id-ID');
}

// Helper: Generate Kode Aset
function generateKodeAset(kategori, urutan) {
  let prefix = 'TH-AST';
  if (CONFIG.KATEGORI && CONFIG.KATEGORI[kategori]) {
    prefix = CONFIG.KATEGORI[kategori].prefix;
  } else if (kategori === 'PROPERTI') {
    prefix = 'TH-PRP';
  } else if (kategori === 'OTOMOTIF') {
    prefix = 'TH-OTO';
  } else if (kategori === 'JASA_SERVIS') {
    prefix = 'TH-JSA';
  }
  return prefix + '-' + String(urutan).padStart(3, '0');
}

// Helper: Generate Nomor E-Faktur Resmi: INV/TH/YYYYMM/XXXX
function generateInvoiceNumber(seq) {
  const d = new Date();
  const yyyymm = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
  const xxxx = String(seq || Math.floor(1000 + Math.random() * 9000)).padStart(4, '0');
  return `INV/TH/${yyyymm}/${xxxx}`;
}

// Helper: Cloudinary Upload URL
function getCloudinaryUploadUrl() {
  return 'https://api.cloudinary.com/v1_1/' + CONFIG.CLOUDINARY_CLOUD_NAME + '/image/upload';
}

// Helper: Cloudinary Optimized URL with watermark protection
function cloudinaryOptimize(url, withWatermark = false) {
  if (!url) return '';
  if (!url.includes('/upload/')) return url;
  
  if (withWatermark) {
    return url.replace('/upload/', '/upload/q_auto,f_auto,l_text:Arial_22_bold:TABAGSEL%20HUB%20%E2%80%A2%20TERVERIFIKASI,co_white,o_55,g_south_east,x_15,y_15/');
  }
  return url.replace('/upload/', '/upload/q_auto,f_auto/');
}

// Helper: WhatsApp Link Generator (Umum)
function waLink(message) {
  return 'https://wa.me/' + CONFIG.ADMIN_WHATSAPP + '?text=' + encodeURIComponent(message);
}

// Helper: WhatsApp Link Generator ke Nomor Spesifik (e.g. Mitra)
function waDirectLink(phone, message) {
  let cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.substring(1);
  }
  return 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(message);
}

// Export for modules if in node/bundler
if (typeof module !== 'undefined') {
  module.exports = {
    CONFIG,
    formatRupiah,
    generateKodeAset,
    generateInvoiceNumber,
    getCloudinaryUploadUrl,
    cloudinaryOptimize,
    waLink,
    waDirectLink,
  };
}
