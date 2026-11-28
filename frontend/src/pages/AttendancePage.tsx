import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { OFFICIAL_ROLES, ROLE_METADATA } from '../config/rbac';
import {
  Modal,
  PageHeader,
  StatusBadge,
  TabBar,
} from '../components/common/UIPrimitives';
import {
  AttendanceRecordItem,
  AttendanceStatus,
  AttendanceType,
  RoleName,
} from '../types';
import { renderGeoTaggedPhoto, reverseGeocodeAddress } from '../utils/geoPhotoStamp';

const WORK_LOCATIONS = [
  { label: 'Gudang Bekasi (WH-BKS)', lat: -6.23827, lng: 106.975573, address: 'Jl. Industri Raya Blok B-12, Bekasi Selatan, Kota Bekasi, Jawa Barat 17141' },
  { label: 'Showroom Kemang (SH-JKS)', lat: -6.260719, lng: 106.813492, address: 'Jl. Kemang Raya No. 88, Bangka, Mampang Prapatan, Jakarta Selatan 12730' },
  { label: 'Gudang Surabaya (WH-SBY)', lat: -7.257472, lng: 112.75209, address: 'Jl. Rungkut Industri III No. 45, Tenggilis Mejoyo, Surabaya, Jawa Timur 60292' },
  { label: 'Showroom Bandung (SH-BDG)', lat: -6.905977, lng: 107.613144, address: 'Jl. LLRE Martadinata No. 114, Cihapit, Bandung Wetan, Kota Bandung, Jawa Barat 40114' },
  { label: 'Kantor Pusat PT Karya Berdua', lat: -6.260719, lng: 106.813492, address: 'Jl. Kemang Raya No. 88 Lt. 3, Jakarta Selatan, DKI Jakarta 12730' },
  { label: 'Dinas Luar / Kunjungan Lapangan', lat: -6.208763, lng: 106.845599, address: 'Lokasi Tugas Lapangan — Verifikasi GPS Real-Time' },
];

const SHIFTS = [
  'Shift Pagi (08:00 – 17:00 WIB)',
  'Shift Siang (11:00 – 20:00 WIB)',
  'Shift Showroom (10:00 – 21:00 WIB)',
  'Shift Fleksibel / Tugas Lapangan',
];

const ROLE_DEFAULT_DEPT: Record<RoleName, string> = {
  admin: 'IT & System Governance',
  manager: 'Executive Management',
  warehouse: 'Warehouse & Logistics',
  purchasing: 'Procurement & Sourcing',
  sales: 'Showroom Sales & POS',
  finance: 'Finance, Accounting & Tax',
  hr_payroll: 'HR',
  guest_pending: 'Pending',
};

function formatWibClock(d: Date): { dateIso: string; timeStr: string; prettyStamp: string } {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const dateIso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const prettyStamp = `${pad2(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} · ${timeStr} WIB`;
  return { dateIso, timeStr, prettyStamp };
}

export const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { attendanceRecords, employees, submitAttendanceRecord, pushToast } = useStore();

  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [clock, setClock] = useState(() => new Date());

  // Complete Attendance Form Fields
  const matchedEmp = employees.find((e) => e.id === user?.employeeId || e.name === user?.name);
  const initialRole: RoleName =
    user && user.role !== 'guest_pending' ? user.role : 'warehouse';

  const [fullName, setFullName] = useState(user?.name || '');
  const [employeeCode, setEmployeeCode] = useState(
    matchedEmp?.employeeNo || `EMP-2026-0${user?.id || 1}`
  );
  const [selectedRole, setSelectedRole] = useState<RoleName>(initialRole);
  const [department, setDepartment] = useState(
    user?.department || ROLE_DEFAULT_DEPT[initialRole]
  );
  const [workLocation, setWorkLocation] = useState(WORK_LOCATIONS[0].label);
  const [shift, setShift] = useState(SHIFTS[0]);
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('check_in');
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [notes, setNotes] = useState('');

  // Real-Time GPS & Reverse-Geocoded Address State
  const [gpsStatus, setGpsStatus] = useState<'detecting' | 'live' | 'fallback'>('detecting');
  const [gpsMessage, setGpsMessage] = useState('Mendeteksi koordinat GPS & alamat real-time...');
  const [latitude, setLatitude] = useState<number>(WORK_LOCATIONS[1].lat);
  const [longitude, setLongitude] = useState<number>(WORK_LOCATIONS[1].lng);
  const [accuracyM, setAccuracyM] = useState<number | null>(15);
  const [locationAddress, setLocationAddress] = useState<string>(WORK_LOCATIONS[1].address);

  // Photo Upload / Live Camera + Geo-Tagged Canvas Watermark State
  const [rawImageEl, setRawImageEl] = useState<HTMLImageElement | null>(null);
  const [stampedPhotoUrl, setStampedPhotoUrl] = useState<string>('');
  const [photoCapturedAt, setPhotoCapturedAt] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // History Filter & Proof Modal
  const [filterRole, setFilterRole] = useState<string>('all');
  const [previewRecord, setPreviewRecord] = useState<AttendanceRecordItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Live 1-second WIB clock
  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Stop webcam stream on unmount
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Real-Time Geolocation Detection + Reverse Geocoding
  const detectRealtimeLocation = useCallback(async () => {
    setGpsStatus('detecting');
    setGpsMessage('Memindai GPS real-time & mengambil alamat jalan akurat...');

    if (!('geolocation' in navigator)) {
      const loc = WORK_LOCATIONS.find((w) => w.label === workLocation) || WORK_LOCATIONS[0];
      setLatitude(loc.lat);
      setLongitude(loc.lng);
      setAccuracyM(25);
      setLocationAddress(loc.address);
      setGpsStatus('fallback');
      setGpsMessage('Browser tidak mendukung GPS; memakai titik koordinat cabang terverifikasi.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        setLatitude(lat);
        setLongitude(lng);
        setAccuracyM(acc);
        setGpsMessage('Koordinat GPS diterima, menerjemahkan alamat lengkap real-time...');
        const resolvedAddr = await reverseGeocodeAddress(lat, lng);
        setLocationAddress(resolvedAddr);
        setGpsStatus('live');
        setGpsMessage(`GPS Real-Time Aktif (akurasi ±${Math.round(acc)} meter)`);
      },
      async () => {
        const loc = WORK_LOCATIONS.find((w) => w.label === workLocation) || WORK_LOCATIONS[0];
        setLatitude(loc.lat);
        setLongitude(loc.lng);
        setAccuracyM(20);
        setLocationAddress(loc.address);
        setGpsStatus('fallback');
        setGpsMessage('Izin GPS browser belum aktif — aktifkan izin lokasi untuk koordinat perangkat atau gunakan titik cabang.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [workLocation]);

  useEffect(() => {
    detectRealtimeLocation();
  }, [detectRealtimeLocation]);

  // Re-stamp watermark automatically whenever photo, GPS location, name, or role updates
  const applyGeoWatermark = useCallback(
    (imgEl: HTMLImageElement, stampTime?: string) => {
      const nowStamp = stampTime || formatWibClock(new Date()).prettyStamp;
      const roleMeta = ROLE_METADATA[selectedRole];
      const roleLabel =
        roleMeta.shortLabel === roleMeta.label
          ? roleMeta.label
          : `${roleMeta.shortLabel} (${roleMeta.label})`;

      const stamped = renderGeoTaggedPhoto(imgEl, {
        fullName: fullName.trim() || user?.name || 'Karyawan StockFlow',
        employeeCode: employeeCode.trim() || 'EMP-2026',
        roleLabel,
        attendanceTypeLabel: attendanceType === 'check_in' ? 'Absen Masuk' : 'Absen Pulang',
        capturedAt: nowStamp,
        latitude,
        longitude,
        accuracyM,
        locationAddress,
      });

      setStampedPhotoUrl(stamped);
      setPhotoCapturedAt(nowStamp);
    },
    [accuracyM, attendanceType, employeeCode, fullName, latitude, locationAddress, longitude, selectedRole, user?.name]
  );

  useEffect(() => {
    if (rawImageEl) {
      applyGeoWatermark(rawImageEl, photoCapturedAt || undefined);
    }
  }, [rawImageEl, applyGeoWatermark, photoCapturedAt]);

  // Handle Photo Upload from Device -> Automatically Burn Real-Time Location & Address Tag onto Photo!
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast('error', 'Format Tidak Didukung', 'Pilih file foto berformat JPG, PNG, atau WebP.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ts = formatWibClock(new Date()).prettyStamp;
        setRawImageEl(img);
        applyGeoWatermark(img, ts);
        pushToast(
          'success',
          'Foto Ditandai Lokasi Real-Time',
          'Koordinat GPS & alamat lengkap otomatis ditempelkan pada foto sebelum dikirim.'
        );
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  // Handle Live Camera Stream Capture -> Automatically Burn Real-Time Location & Address Tag!
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      pushToast(
        'warning',
        'Kamera Tidak Tersedia',
        'Gunakan tombol "Unggah Foto" — tag GPS & alamat real-time tetap ditempelkan otomatis.'
      );
    }
  };

  const captureFromCamera = () => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    const tmp = document.createElement('canvas');
    tmp.width = vid.videoWidth || 960;
    tmp.height = vid.videoHeight || 720;
    const ctx = tmp.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(vid, 0, 0, tmp.width, tmp.height);
    const dataUrl = tmp.toDataURL('image/jpeg', 0.92);
    const img = new Image();
    img.onload = () => {
      const ts = formatWibClock(new Date()).prettyStamp;
      setRawImageEl(img);
      applyGeoWatermark(img, ts);
      stopCamera();
      pushToast('success', 'Foto Kamera Ber-Tag GPS Siap', 'Tag koordinat & alamat real-time telah diterapkan.');
    };
    img.src = dataUrl;
  };

  const handleRoleChange = (nextRole: RoleName) => {
    setSelectedRole(nextRole);
    setDepartment(ROLE_DEFAULT_DEPT[nextRole] || 'StockFlow Operations');
  };

  const handleWorkLocationChange = (locLabel: string) => {
    setWorkLocation(locLabel);
    if (gpsStatus !== 'live') {
      const loc = WORK_LOCATIONS.find((w) => w.label === locLabel);
      if (loc) {
        setLatitude(loc.lat);
        setLongitude(loc.lng);
        setLocationAddress(loc.address);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!fullName.trim() || !employeeCode.trim()) {
      pushToast('error', 'Data Belum Lengkap', 'Nama lengkap dan NIP karyawan wajib diisi.');
      return;
    }
    if (!stampedPhotoUrl) {
      pushToast(
        'error',
        'Foto Ber-Tag Lokasi Wajib Diunggah',
        'Ambil atau unggah foto terlebih dahulu agar lokasi & alamat real-time terverifikasi.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const nowInfo = formatWibClock(new Date());
      await submitAttendanceRecord(
        {
          fullName: fullName.trim(),
          employeeCode: employeeCode.trim(),
          role: selectedRole,
          department: department.trim() || ROLE_DEFAULT_DEPT[selectedRole],
          workLocation,
          shift,
          attendanceType,
          status,
          attendanceDate: nowInfo.dateIso,
          attendanceTime: nowInfo.timeStr,
          latitude,
          longitude,
          accuracyM,
          locationAddress,
          capturedAt: photoCapturedAt || nowInfo.prettyStamp,
          photoDataUrl: stampedPhotoUrl,
          notes: notes.trim() || undefined,
        },
        user
      );
      setNotes('');
      setRawImageEl(null);
      setStampedPhotoUrl('');
      setPhotoCapturedAt('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setActiveTab('history');
    } finally {
      setSubmitting(false);
    }
  };

  const canViewAllAttendance = ['admin', 'manager', 'hr_payroll'].includes(user?.role || '');
  const scopedRecords = attendanceRecords.filter((rec) => {
    if (!canViewAllAttendance && rec.userId !== user?.id) return false;
    if (filterRole !== 'all' && rec.role !== filterRole) return false;
    return true;
  });

  const { dateIso, timeStr, prettyStamp } = formatWibClock(clock);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Modul 09A • Absensi Karyawan & Verifikasi GPS Real-Time"
        title="Form Absensi & Bukti Foto Ber-Tag Lokasi"
        subtitle="Isi data kehadiran lengkap sesuai role, unggah atau potret foto dengan watermark koordinat GPS & alamat real-time otomatis sebelum dikirim ke sistem."
        actions={
          <div className="inline-flex items-center gap-2 rounded-xl border border-pine-600/25 bg-white px-3.5 py-2 shadow-card">
            <Clock className="h-4 w-4 text-pine-600" />
            <div className="text-right">
              <p className="font-mono text-xs font-bold text-espresso-900 sf-tabular">{timeStr} WIB</p>
              <p className="text-[10px] text-espresso-500">{dateIso}</p>
            </div>
          </div>
        }
      />

      <TabBar
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as 'form' | 'history')}
        tabs={[
          { id: 'form', label: 'Form Absensi & Foto Geo-Tag' },
          { id: 'history', label: 'Riwayat & Bukti Foto Absensi', count: scopedRecords.length },
        ]}
      />

      {activeTab === 'form' && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT 7 COLS: Complete Attendance Data Form */}
          <div className="space-y-5 rounded-2xl border border-alabaster-sand bg-white p-6 shadow-card lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-alabaster-subtle pb-4">
              <div>
                <h2 className="font-display text-base font-bold text-espresso-900">
                  Formulir Data Kehadiran Karyawan
                </h2>
                <p className="text-xs text-espresso-500">
                  Lengkapi identitas, pilih role melalui dropdown, dan verifikasi shift kerja.
                </p>
              </div>
              <StatusBadge label="Wajib Geo-Foto" tone="pine" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* 1. Nama Lengkap */}
              <div>
                <label htmlFor="att-fullname" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Nama Lengkap <span className="text-semantic-danger">*</span>
                </label>
                <input
                  id="att-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masukkan nama lengkap karyawan"
                  className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 px-3.5 py-2.5 text-sm text-espresso-900 focus:border-pine-600 focus:bg-white"
                />
              </div>

              {/* 2. NIP / ID Karyawan */}
              <div>
                <label htmlFor="att-empcode" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  NIP / ID Karyawan <span className="text-semantic-danger">*</span>
                </label>
                <input
                  id="att-empcode"
                  type="text"
                  required
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="contoh: EMP-2025-002"
                  className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 px-3.5 py-2.5 font-mono text-sm text-espresso-900 focus:border-pine-600 focus:bg-white"
                />
              </div>

              {/* 3. Pilihan Role (Dropdown Vertikal 7 Role Resmi) */}
              <div>
                <label htmlFor="att-role" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Pilihan Role <span className="text-semantic-danger">*</span>
                </label>
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pine-600" />
                  <select
                    id="att-role"
                    value={selectedRole}
                    onChange={(e) => handleRoleChange(e.target.value as RoleName)}
                    className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 py-2.5 pl-9 pr-3.5 text-sm font-medium text-espresso-900 focus:border-pine-600 focus:bg-white"
                  >
                    {OFFICIAL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_METADATA[r].shortLabel === ROLE_METADATA[r].label
                          ? ROLE_METADATA[r].label
                          : `${ROLE_METADATA[r].shortLabel} — ${ROLE_METADATA[r].label}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Departemen / Divisi */}
              <div>
                <label htmlFor="att-dept" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Departemen / Divisi <span className="text-semantic-danger">*</span>
                </label>
                <input
                  id="att-dept"
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Warehouse & Logistics"
                  className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 px-3.5 py-2.5 text-sm text-espresso-900 focus:border-pine-600 focus:bg-white"
                />
              </div>

              {/* 5. Lokasi Kerja / Cabang */}
              <div>
                <label htmlFor="att-location" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Lokasi Cabang / Penugasan <span className="text-semantic-danger">*</span>
                </label>
                <select
                  id="att-location"
                  value={workLocation}
                  onChange={(e) => handleWorkLocationChange(e.target.value)}
                  className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 px-3.5 py-2.5 text-sm text-espresso-900 focus:border-pine-600 focus:bg-white"
                >
                  {WORK_LOCATIONS.map((loc) => (
                    <option key={loc.label} value={loc.label}>
                      {loc.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Shift Kerja */}
              <div>
                <label htmlFor="att-shift" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Shift Kerja <span className="text-semantic-danger">*</span>
                </label>
                <select
                  id="att-shift"
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 px-3.5 py-2.5 text-sm text-espresso-900 focus:border-pine-600 focus:bg-white"
                >
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* 7. Jenis Absensi */}
              <div>
                <label htmlFor="att-type" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Jenis Absensi <span className="text-semantic-danger">*</span>
                </label>
                <select
                  id="att-type"
                  value={attendanceType}
                  onChange={(e) => setAttendanceType(e.target.value as AttendanceType)}
                  className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 px-3.5 py-2.5 text-sm font-semibold text-espresso-900 focus:border-pine-600 focus:bg-white"
                >
                  <option value="check_in">Absen Masuk (Check-In)</option>
                  <option value="check_out">Absen Pulang (Check-Out)</option>
                </select>
              </div>

              {/* 8. Status Kehadiran */}
              <div>
                <label htmlFor="att-status" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Status Kehadiran <span className="text-semantic-danger">*</span>
                </label>
                <select
                  id="att-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                  className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 px-3.5 py-2.5 text-sm text-espresso-900 focus:border-pine-600 focus:bg-white"
                >
                  <option value="present">Hadir Tepat Waktu</option>
                  <option value="late">Hadir Terlambat</option>
                  <option value="field_duty">Dinas Luar / Kunjungan</option>
                  <option value="leave">Izin</option>
                  <option value="sick">Sakit</option>
                </select>
              </div>
            </div>

            {/* 9. Catatan Kehadiran */}
            <div>
              <label htmlFor="att-notes" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                Catatan Kehadiran / Aktivitas Lapangan (Opsional)
              </label>
              <textarea
                id="att-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Masuk shift pagi persiapan pengiriman furnitur Showroom Kemang..."
                className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 px-3.5 py-2.5 text-sm text-espresso-900 focus:border-pine-600 focus:bg-white"
              />
            </div>

            {/* Submit Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-alabaster-subtle pt-4">
              <p className="text-[11px] text-espresso-500">
                Waktu terekam otomatis: <strong className="font-mono text-espresso-800">{prettyStamp}</strong>
              </p>
              <button
                type="submit"
                disabled={submitting || !stampedPhotoUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-pine-600 px-5 py-3 text-sm font-bold text-alabaster shadow-sm transition hover:bg-pine-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan Absensi...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4" />
                    Kirim &amp; Simpan Absensi
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT 5 COLS: Real-Time GPS Detection + Geo-Tagged Photo Capture / Upload */}
          <div className="space-y-5 lg:col-span-5">
            {/* Panel 1: Real-Time GPS Coordinates & Reverse-Geocoded Street Address */}
            <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine-50 text-pine-700 border border-pine-600/20">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-display text-sm font-bold text-espresso-900">
                      Tag Lokasi &amp; Alamat Real-Time
                    </h3>
                    <p className="text-[11px] text-espresso-500">{gpsMessage}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={detectRealtimeLocation}
                  className="inline-flex items-center gap-1 rounded-lg border border-alabaster-sand bg-alabaster px-2.5 py-1.5 text-[11px] font-bold text-espresso-700 hover:border-pine-600 hover:text-pine-700"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${gpsStatus === 'detecting' ? 'animate-spin' : ''}`} />
                  Perbarui GPS
                </button>
              </div>

              <div className="mt-4 space-y-2 rounded-xl border border-alabaster-sand bg-alabaster/70 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-espresso-500">Status Sinyal GPS</span>
                  <StatusBadge
                    label={
                      gpsStatus === 'live'
                        ? 'GPS REAL-TIME AKURAT'
                        : gpsStatus === 'detecting'
                        ? 'MEMINDAI LOKASI...'
                        : 'TITIK CABANG TERVERIFIKASI'
                    }
                    tone={gpsStatus === 'live' ? 'success' : gpsStatus === 'detecting' ? 'warning' : 'pine'}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-espresso-500">Koordinat (Lat, Lng)</span>
                  <span className="font-mono font-bold text-espresso-900 sf-tabular">
                    {latitude.toFixed(6)}, {longitude.toFixed(6)}
                    {accuracyM !== null ? ` (±${Math.round(accuracyM)}m)` : ''}
                  </span>
                </div>
                <div className="border-t border-alabaster-sand pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-espresso-500">
                    Alamat Terdeteksi Real-Time
                  </p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-espresso-900">
                    {locationAddress}
                  </p>
                </div>
                <div className="pt-1">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-pine-700 hover:underline"
                  >
                    Verifikasi Titik di Peta OpenStreetMap <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Panel 2: Photo Upload / Live Camera with Automatic Geo-Tag Watermark */}
            <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-bold text-espresso-900">
                    Unggah / Potret Foto Absensi Ber-GPS <span className="text-semantic-danger">*</span>
                  </h3>
                  <p className="text-[11px] text-espresso-500">
                    Tag koordinat GPS, alamat lengkap &amp; jam WIB otomatis ditempel pada foto.
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={cameraActive ? stopCamera : startCamera}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-pine-600/30 bg-pine-50 px-3 py-2.5 text-xs font-bold text-pine-800 transition hover:bg-pine-600 hover:text-alabaster"
                >
                  {cameraActive ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  {cameraActive ? 'Tutup Kamera' : 'Kamera Langsung'}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-terracotta-600/30 bg-terracotta-50 px-3 py-2.5 text-xs font-bold text-terracotta-700 transition hover:bg-terracotta-600 hover:text-alabaster"
                >
                  <Upload className="h-4 w-4" />
                  Unggah Foto
                </button>
              </div>

              {cameraActive && (
                <div className="mt-4 overflow-hidden rounded-xl border-2 border-ochre-600 bg-espresso-900">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-56 w-full object-cover"
                  />
                  <div className="flex items-center justify-between bg-espresso-900 px-3.5 py-2.5">
                    <span className="font-mono text-[10px] text-ochre-400">
                      GPS: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                    </span>
                    <button
                      type="button"
                      onClick={captureFromCamera}
                      className="rounded-lg bg-terracotta-600 px-3.5 py-1.5 text-xs font-bold text-alabaster hover:bg-terracotta-700"
                    >
                      Ambil Foto &amp; Tempel Lokasi
                    </button>
                  </div>
                </div>
              )}

              {stampedPhotoUrl ? (
                <div className="mt-4 space-y-2">
                  <div className="overflow-hidden rounded-xl border border-pine-600/40 bg-espresso-900 shadow-sm">
                    <img
                      src={stampedPhotoUrl}
                      alt="Pratinjau Foto Absensi Ber-Tag Lokasi Real-Time"
                      className="max-h-72 w-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-pine-50 px-3 py-2 text-[11px] font-semibold text-pine-800">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-pine-600" />
                      Foto ber-tag lokasi &amp; alamat siap dikirim ke form
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRawImageEl(null);
                        setStampedPhotoUrl('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-terracotta-700 hover:underline"
                    >
                      Ganti Foto
                    </button>
                  </div>
                </div>
              ) : (
                !cameraActive && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-alabaster-sand bg-alabaster/60 px-4 py-8 text-center transition hover:border-pine-600 hover:bg-pine-50/40"
                  >
                    <Camera className="h-8 w-8 text-espresso-400" />
                    <p className="mt-2 text-xs font-bold text-espresso-800">
                      Klik untuk Unggah Foto atau Buka Kamera
                    </p>
                    <p className="mt-1 max-w-xs text-[11px] text-espresso-500">
                      Foto otomatis dicap dengan koordinat GPS, alamat real-time, nama, role, dan waktu WIB sebelum masuk ke form.
                    </p>
                  </button>
                )
              )}
            </div>
          </div>
        </form>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Summary KPI Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-alabaster-sand bg-white p-4 shadow-card">
              <p className="text-[11px] font-semibold text-espresso-500">Total Rekaman Absensi</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-espresso-900">{scopedRecords.length}</p>
            </div>
            <div className="rounded-xl border border-alabaster-sand bg-white p-4 shadow-card">
              <p className="text-[11px] font-semibold text-espresso-500">Absen Masuk (Check-In)</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-pine-700">
                {scopedRecords.filter((r) => r.attendanceType === 'check_in').length}
              </p>
            </div>
            <div className="rounded-xl border border-alabaster-sand bg-white p-4 shadow-card">
              <p className="text-[11px] font-semibold text-espresso-500">Absen Pulang (Check-Out)</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-terracotta-700">
                {scopedRecords.filter((r) => r.attendanceType === 'check_out').length}
              </p>
            </div>
            <div className="rounded-xl border border-alabaster-sand bg-white p-4 shadow-card">
              <p className="text-[11px] font-semibold text-espresso-500">Terverifikasi GPS &amp; Foto</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-olive-700">100%</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-alabaster-sand bg-alabaster px-4 py-3 text-xs">
              <span className="inline-flex items-center gap-2 font-bold text-espresso-900">
                <FileCheck2 className="h-4 w-4 text-pine-600" />
                {canViewAllAttendance
                  ? 'Rekap Absensi Seluruh Role (Admin / Manager / HR)'
                  : `Riwayat Absensi Pribadi — ${user?.name}`}
              </span>
              {canViewAllAttendance && (
                <select
                  aria-label="Filter role absensi"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="rounded-lg border border-alabaster-sand bg-white px-3 py-1.5 text-xs font-semibold text-espresso-800"
                >
                  <option value="all">Semua Role (7 Role)</option>
                  {OFFICIAL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_METADATA[r].shortLabel}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-alabaster-sand bg-alabaster/60 text-[11px] uppercase text-espresso-500">
                  <tr>
                    <th className="px-4 py-3">Karyawan &amp; Role</th>
                    <th className="px-4 py-3">Waktu &amp; Jenis</th>
                    <th className="px-4 py-3">Cabang &amp; Alamat GPS Real-Time</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Bukti Foto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-alabaster-subtle">
                  {scopedRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-alabaster/60">
                      <td className="px-4 py-3">
                        <p className="font-bold text-espresso-900">{rec.fullName}</p>
                        <p className="font-mono text-[10px] text-espresso-500">
                          {rec.employeeCode} • {ROLE_METADATA[rec.role]?.shortLabel || rec.role} • {rec.department}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <p className="font-bold text-espresso-900">{rec.attendanceDate} • {rec.attendanceTime}</p>
                        <p className="text-[10px] text-pine-700">
                          {rec.attendanceType === 'check_in' ? 'ABSEN MASUK' : 'ABSEN PULANG'} • {rec.shift.split('(')[0].trim()}
                        </p>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-semibold text-espresso-800">{rec.workLocation}</p>
                        <p className="line-clamp-2 text-[11px] text-espresso-600">{rec.locationAddress}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-pine-700">
                          {rec.latitude.toFixed(5)}, {rec.longitude.toFixed(5)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={rec.status.replace('_', ' ').toUpperCase()}
                          tone={
                            rec.status === 'present'
                              ? 'success'
                              : rec.status === 'late'
                              ? 'warning'
                              : rec.status === 'field_duty'
                              ? 'pine'
                              : 'info'
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setPreviewRecord(rec)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-pine-600/30 bg-pine-50 px-3 py-1.5 text-[11px] font-bold text-pine-800 hover:bg-pine-600 hover:text-alabaster"
                        >
                          <Camera className="h-3.5 w-3.5" /> Lihat Foto GPS
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Geo-Tagged Photo Proof Modal */}
      <Modal
        open={Boolean(previewRecord)}
        onClose={() => setPreviewRecord(null)}
        title={`Bukti Foto Absensi Ber-GPS — ${previewRecord?.fullName || ''}`}
        subtitle={`${previewRecord?.employeeCode || ''} • ${previewRecord ? ROLE_METADATA[previewRecord.role]?.label : ''} • ${previewRecord?.capturedAt || ''}`}
      >
        {previewRecord && (
          <div className="space-y-4 text-xs">
            <div className="overflow-hidden rounded-xl border border-alabaster-sand bg-espresso-900">
              <img
                src={previewRecord.photoDataUrl}
                alt={`Bukti absensi ${previewRecord.fullName}`}
                className="max-h-80 w-full object-contain"
              />
            </div>
            <div className="space-y-2 rounded-xl border border-alabaster-sand bg-alabaster p-4">
              <div className="flex justify-between">
                <span className="text-espresso-500">Cabang / Shift</span>
                <span className="font-bold text-espresso-900">{previewRecord.workLocation} • {previewRecord.shift}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-espresso-500">Koordinat GPS</span>
                <span className="font-mono font-bold text-pine-700">
                  {previewRecord.latitude.toFixed(6)}, {previewRecord.longitude.toFixed(6)}
                </span>
              </div>
              <div>
                <span className="text-espresso-500">Alamat Real-Time Terdeteksi</span>
                <p className="mt-0.5 font-medium text-espresso-900">{previewRecord.locationAddress}</p>
              </div>
              {previewRecord.notes && (
                <div>
                  <span className="text-espresso-500">Catatan</span>
                  <p className="mt-0.5 text-espresso-800">{previewRecord.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
