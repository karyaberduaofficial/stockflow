import React, { useMemo, useState } from 'react';
import { Filter, Plus, Search, Building2, Package, Users, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { EmptyState, Modal, PageHeader, StatusBadge, TabBar } from '../components/common/UIPrimitives';
import { formatIDR, getTotalProductStock, maskBankAccount, maskNik } from '../utils/format';

export const MasterDataPage: React.FC = () => {
  const { user } = useAuth();
  const { products, categories, brands, units, warehouses, suppliers, customers, employees, addProduct } = useStore();
  const [activeTab, setActiveTab] = useState('products');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'healthy'>('all');
  const [modalOpen, setModalOpen] = useState(false);

  const [newSku, setNewSku] = useState('SF-LR-099');
  const [newBarcode, setNewBarcode] = useState('8994120001999');
  const [newName, setNewName] = useState('');
  const [newVariant, setNewVariant] = useState('Natural Teak');
  const [newCategoryId, setNewCategoryId] = useState(1);
  const [newBuy, setNewBuy] = useState(1_500_000);
  const [newSell, setNewSell] = useState(2_650_000);
  const [newMin, setNewMin] = useState(10);

  const canUnmaskPii = user?.role === 'hr_payroll';
  const canCreateProduct = ['admin', 'purchasing', 'warehouse'].includes(user?.role || '');

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = search.trim().toLowerCase();
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.brandName.toLowerCase().includes(q);
      const matchCat = catFilter === 'all' || String(p.categoryId) === catFilter;
      const total = getTotalProductStock(p.stockByWarehouse);
      const matchStock =
        stockFilter === 'all' ||
        (stockFilter === 'low' && total <= p.minStock) ||
        (stockFilter === 'healthy' && total > p.minStock);
      return matchQ && matchCat && matchStock;
    });
  }, [products, search, catFilter, stockFilter]);

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    const cat = categories.find((c) => c.id === Number(newCategoryId)) || categories[0];
    addProduct(
      {
        sku: newSku.trim().toUpperCase(),
        barcode: newBarcode.trim(),
        name: newName.trim(),
        variant: newVariant.trim(),
        categoryId: cat.id,
        categoryName: cat.name,
        brandName: brands[0].name,
        unitCode: units[0].code,
        buyPrice: Number(newBuy),
        wacCost: Number(newBuy),
        sellPrice: Number(newSell),
        minStock: Number(newMin),
        safetyStock: Math.max(3, Math.floor(Number(newMin) / 2)),
        avgDailyDemand: 1.5,
        leadTimeDays: 6,
        stockByWarehouse: { 1: 12, 2: 4, 3: 6, 4: 2 },
        active: true,
      },
      user
    );
    setModalOpen(false);
    setNewName('');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Modul 02 • Master Data Terpusat"
        title="Katalog Produk, Gudang, Relasi & SDM"
        subtitle="Kelola data induk furnitur, kategori, merek, satuan, pemasok, pelanggan, lokasi gudang, dan direktori karyawan."
        actions={
          canCreateProduct && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-pine-600 px-4 py-2.5 text-xs font-bold text-alabaster shadow-sm hover:bg-pine-700"
            >
              <Plus className="h-4 w-4" />
              Tambah Produk Furnitur
            </button>
          )
        }
      />

      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'products', label: 'Produk & Varian', count: products.length },
          { id: 'taxonomy', label: 'Kategori, Merek & Satuan', count: categories.length },
          { id: 'warehouses', label: 'Gudang & Showroom', count: warehouses.length },
          { id: 'suppliers', label: 'Pemasok (Supplier)', count: suppliers.length },
          { id: 'customers', label: 'Pelanggan (Customer)', count: customers.length },
          { id: 'employees', label: 'Karyawan & Dept', count: employees.length },
        ]}
      />

      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Advanced Multi-Facet Filter */}
          <div className="flex flex-col gap-3 rounded-2xl border border-alabaster-sand bg-white p-4 shadow-card sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter SKU, Barcode, Nama Produk, atau Merek..."
                className="w-full rounded-lg border border-alabaster-sand bg-alabaster/60 py-2 pl-9 pr-3 text-xs focus:border-pine-600 focus:bg-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-espresso-500" />
              <select
                aria-label="Filter kategori"
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="rounded-lg border border-alabaster-sand bg-alabaster px-3 py-2 text-xs font-medium text-espresso-800"
              >
                <option value="all">Semua Kategori ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                aria-label="Filter status stok"
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as 'all' | 'low' | 'healthy')}
                className="rounded-lg border border-alabaster-sand bg-alabaster px-3 py-2 text-xs font-medium text-espresso-800"
              >
                <option value="all">Semua Status Stok</option>
                <option value="low">Stok Rendah (Kritis)</option>
                <option value="healthy">Stok Aman</option>
              </select>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <EmptyState
              title="Produk tidak ditemukan"
              description="Coba ubah kata kunci pencarian atau reset filter kategori dan status stok."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCatFilter('all');
                    setStockFilter('all');
                  }}
                  className="rounded-lg bg-pine-600 px-3.5 py-2 text-xs font-semibold text-alabaster"
                >
                  Reset Filter
                </button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase tracking-wider text-espresso-500">
                    <tr>
                      <th className="px-4 py-3">SKU / Barcode</th>
                      <th className="px-4 py-3">Nama Produk &amp; Varian</th>
                      <th className="px-4 py-3">Kategori</th>
                      <th className="px-4 py-3 text-right">Harga Beli / WAC</th>
                      <th className="px-4 py-3 text-right">Harga Jual</th>
                      <th className="px-4 py-3 text-right">Total Stok</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-alabaster-subtle">
                    {filteredProducts.map((p) => {
                      const total = getTotalProductStock(p.stockByWarehouse);
                      const isLow = total <= p.minStock;
                      return (
                        <tr key={p.id} className="hover:bg-alabaster/70">
                          <td className="px-4 py-3 font-mono">
                            <p className="font-bold text-pine-700">{p.sku}</p>
                            <p className="text-[10px] text-espresso-500">{p.barcode}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-espresso-900">{p.name}</p>
                            <p className="text-[11px] text-espresso-500">{p.variant} • {p.brandName}</p>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge label={p.categoryName} tone="neutral" />
                          </td>
                          <td className="px-4 py-3 text-right font-mono sf-tabular text-espresso-700">
                            {formatIDR(p.wacCost)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold sf-tabular text-espresso-900">
                            {formatIDR(p.sellPrice)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold sf-tabular text-espresso-900">
                            {total} {p.unitCode}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              label={isLow ? `Rendah (Min ${p.minStock})` : 'Aktif'}
                              tone={isLow ? 'danger' : 'success'}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'taxonomy' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card lg:col-span-2">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-espresso-900">
              <Package className="h-4 w-4 text-pine-600" /> Kategori Furnitur &amp; Homeware
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {categories.map((c) => (
                <div key={c.id} className="rounded-xl border border-alabaster-sand bg-alabaster/60 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-pine-700">{c.code}</span>
                    <StatusBadge label={`${c.productCount} SKU`} tone="pine" />
                  </div>
                  <p className="mt-1 font-display text-sm font-bold text-espresso-900">{c.name}</p>
                  <p className="mt-0.5 text-xs text-espresso-600">{c.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
              <h3 className="font-display text-sm font-bold text-espresso-900">Merek (Brands)</h3>
              <ul className="mt-3 space-y-2 text-xs">
                {brands.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-lg bg-alabaster px-3 py-2">
                    <span className="font-semibold text-espresso-800">{b.name}</span>
                    <span className="text-espresso-500">{b.origin}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
              <h3 className="font-display text-sm font-bold text-espresso-900">Satuan (Units)</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {units.map((u) => (
                  <span key={u.id} className="rounded-lg border border-alabaster-sand bg-alabaster px-3 py-1.5 text-xs">
                    <strong className="font-mono text-pine-700">{u.code}</strong> — {u.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'warehouses' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {warehouses.map((w) => {
            const util = Math.round((w.usedUnits / w.capacityUnits) * 100);
            return (
              <div key={w.id} className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card sf-card-interactive">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-terracotta-600">{w.code}</span>
                    <h3 className="mt-0.5 font-display text-lg font-bold text-espresso-900">{w.name}</h3>
                    <p className="text-xs text-espresso-600">{w.address}, {w.city}</p>
                  </div>
                  <Building2 className="h-5 w-5 text-pine-600" />
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-espresso-500">Utilisasi Kapasitas</span>
                    <span className="font-mono font-bold text-espresso-900">{w.usedUnits} / {w.capacityUnits} unit ({util}%)</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-alabaster-subtle">
                    <div className="h-full rounded-full bg-pine-600" style={{ width: `${util}%` }} />
                  </div>
                </div>
                <p className="mt-3 text-xs text-espresso-500">Penanggung Jawab: <strong className="text-espresso-800">{w.managerName}</strong></p>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {suppliers.map((s) => (
            <div key={s.id} className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-pine-700">{s.code}</span>
                  <h3 className="font-display text-base font-bold text-espresso-900">{s.name}</h3>
                  <p className="text-xs text-espresso-600">PIC: {s.contactPerson} • {s.city} • {s.phone}</p>
                </div>
                <Truck className="h-5 w-5 text-terracotta-600" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-alabaster p-3 text-center text-xs">
                <div>
                  <p className="text-[10px] text-espresso-500">Lead Time</p>
                  <p className="font-mono font-bold text-espresso-900">{s.leadTimeDays} Hari</p>
                </div>
                <div>
                  <p className="text-[10px] text-espresso-500">On-Time Rate</p>
                  <p className="font-mono font-bold text-semantic-success">{s.onTimeRate}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-espresso-500">TOP</p>
                  <p className="font-mono font-bold text-espresso-900">Net {s.paymentTermsDays}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase text-espresso-500">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama Pelanggan</th>
                  <th className="px-4 py-3">Segmen</th>
                  <th className="px-4 py-3">Kota &amp; Kontak</th>
                  <th className="px-4 py-3 text-right">Batas Kredit</th>
                  <th className="px-4 py-3 text-right">Saldo Piutang (AR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-alabaster/70">
                    <td className="px-4 py-3 font-mono font-bold text-pine-700">{c.code}</td>
                    <td className="px-4 py-3 font-semibold text-espresso-900">{c.name}</td>
                    <td className="px-4 py-3"><StatusBadge label={c.segment} tone="terracotta" /></td>
                    <td className="px-4 py-3 text-espresso-600">{c.city} • {c.phone}</td>
                    <td className="px-4 py-3 text-right font-mono sf-tabular">{formatIDR(c.creditLimit)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold sf-tabular text-terracotta-700">{formatIDR(c.receivableBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-alabaster-sand bg-alabaster px-4 py-3 text-xs">
            <span className="flex items-center gap-2 font-semibold text-espresso-800">
              <Users className="h-4 w-4 text-pine-600" />
              Direktori Karyawan &amp; Proteksi PII (UU PDP)
            </span>
            <StatusBadge
              label={canUnmaskPii ? 'Akses PII Terbuka (HR/Admin)' : 'PII Tersamar (Non-HR)'}
              tone={canUnmaskPii ? 'pine' : 'warning'}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster/60 text-[11px] uppercase text-espresso-500">
                <tr>
                  <th className="px-4 py-3">NIP</th>
                  <th className="px-4 py-3">Nama &amp; Jabatan</th>
                  <th className="px-4 py-3">Departemen</th>
                  <th className="px-4 py-3">NIK (Terenkripsi)</th>
                  <th className="px-4 py-3">Rekening Bank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-alabaster/70">
                    <td className="px-4 py-3 font-mono font-bold text-pine-700">{emp.employeeNo}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-espresso-900">{emp.name}</p>
                      <p className="text-[11px] text-espresso-500">{emp.position}</p>
                    </td>
                    <td className="px-4 py-3 text-espresso-700">{emp.department}</td>
                    <td className="px-4 py-3 font-mono text-espresso-700">{maskNik(emp.nik, canUnmaskPii)}</td>
                    <td className="px-4 py-3 font-mono text-espresso-700">
                      {emp.bankName} {maskBankAccount(emp.bankAccount, canUnmaskPii)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Produk Furnitur / Homeware Baru">
        <form onSubmit={handleAddProduct} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-espresso-700">SKU</label>
              <input value={newSku} onChange={(e) => setNewSku(e.target.value)} required className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-espresso-700">Barcode EAN-13</label>
              <input value={newBarcode} onChange={(e) => setNewBarcode(e.target.value)} required className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
            </div>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-espresso-700">Nama Produk</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Contoh: Nakas Kayu Jati 2 Laci" className="w-full rounded-lg border border-alabaster-sand px-3 py-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-espresso-700">Kategori</label>
              <select value={newCategoryId} onChange={(e) => setNewCategoryId(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-espresso-700">Varian / Finishing</label>
              <input value={newVariant} onChange={(e) => setNewVariant(e.target.value)} className="w-full rounded-lg border border-alabaster-sand px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-espresso-700">Harga Beli (Rp)</label>
              <input type="number" value={newBuy} onChange={(e) => setNewBuy(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-espresso-700">Harga Jual (Rp)</label>
              <input type="number" value={newSell} onChange={(e) => setNewSell(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-espresso-700">Min Stok</label>
              <input type="number" value={newMin} onChange={(e) => setNewMin(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-alabaster-sand px-4 py-2 font-semibold text-espresso-700">Batal</button>
            <button type="submit" className="rounded-lg bg-pine-600 px-4 py-2 font-bold text-alabaster hover:bg-pine-700">Simpan Produk</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
