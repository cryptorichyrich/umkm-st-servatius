import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Edit, Trash2, Eye, Info, Loader2 } from 'lucide-react';
import { supabase, type Product, type BusinessStatus } from '../../lib/supabase';
import ProductForm from './ProductForm';

interface ProductManagerProps {
  businessId: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatPrice(price: number | null, note: string): string {
  if (price != null) {
    return `Rp ${new Intl.NumberFormat('id-ID').format(price)}`;
  }
  return note || 'Harga nego';
}

const idrFormatter = new Intl.NumberFormat('id-ID');

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ProductManager({ businessId }: ProductManagerProps) {
  const [businessStatus, setBusinessStatus] = useState<BusinessStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─────────────────────────────────────────────
  // Fetch business status
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!businessId) {
      setStatusLoading(false);
      return;
    }

    setStatusLoading(true);
    (async () => {
      const { data, error: bizErr } = await supabase
        .from('businesses')
        .select('status')
        .eq('id', businessId)
        .single();

      if (bizErr) {
        console.error('Business status fetch error:', bizErr);
        setBusinessStatus(null);
      } else {
        setBusinessStatus(data.status as BusinessStatus);
      }
      setStatusLoading(false);
    })();
  }, [businessId]);

  // ─────────────────────────────────────────────
  // Fetch products for this business
  // ─────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    if (!businessId) return;

    setProductsLoading(true);
    setError(null);
    try {
      const { data, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (prodErr) throw prodErr;
      setProducts((data || []) as Product[]);
    } catch (err) {
      console.error('Products fetch error:', err);
      setError('Gagal memuat produk. Silakan coba lagi.');
    } finally {
      setProductsLoading(false);
    }
  }, [businessId]);

  // Fetch products when businessId changes and status is approved
  useEffect(() => {
    if (businessId && businessStatus === 'approved') {
      fetchProducts();
    }
  }, [businessId, businessStatus, fetchProducts]);

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────
  const handleToggleAvailable = async (product: Product) => {
    try {
      const { error: updErr } = await supabase
        .from('products')
        .update({ is_available: !product.is_available })
        .eq('id', product.id);

      if (updErr) throw updErr;

      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, is_available: !p.is_available } : p,
        ),
      );
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal mengubah status: ${err.message}`
          : 'Gagal mengubah status.',
      );
    }
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.')) return;

    setDeletingProductId(productId);
    try {
      const { error: delErr } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (delErr) throw delErr;

      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menghapus produk: ${err.message}`
          : 'Gagal menghapus produk.',
      );
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleAddProduct = () => {
    setEditingProductId(null);
    setShowForm(true);
  };

  const handleEditProduct = (productId: string) => {
    setEditingProductId(productId);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingProductId(null);
  };

  const handleProductSaved = () => {
    setShowForm(false);
    setEditingProductId(null);
    fetchProducts();
  };

  // ─────────────────────────────────────────────
  // Render: no businessId
  // ─────────────────────────────────────────────
  if (!businessId) return null;

  // ─────────────────────────────────────────────
  // Render: loading business status
  // ─────────────────────────────────────────────
  if (statusLoading) {
    return (
      <div className="mt-8 border-t border-paroki-200 pt-8">
        <div className="flex items-center gap-2 text-sm text-paroki-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat data produk...
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // Render: business not approved
  // ─────────────────────────────────────────────
  if (businessStatus !== 'approved') {
    return (
      <div className="mt-8 border-t border-paroki-200 pt-8">
        <div className="flex items-start gap-3 rounded-xl border border-paroki-200 bg-paroki-50 px-4 py-4">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-paroki-500" />
          <p className="text-sm text-paroki-700">
            Produk dapat ditambahkan setelah usaha Anda disetujui oleh admin.
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: approved business — full product manager
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="mt-8 border-t border-paroki-200 pt-8">
      {/* ── Inline ProductForm view ── */}
      {showForm ? (
        <div>
          <button
            onClick={handleCancelForm}
            className="mb-3 inline-flex items-center gap-1 text-sm text-paroki-500 hover:text-paroki-700"
          >
            ← Kembali
          </button>
          <ProductForm
            key={`${businessId}-${editingProductId || 'new'}`}
            businessId={businessId}
            productId={editingProductId || undefined}
            onSaved={handleProductSaved}
            onCancel={handleCancelForm}
          />
        </div>
      ) : (
        <>
          {/* ── Section Header ── */}
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-paroki-900">
              <Package className="h-5 w-5 text-paroki-500" />
              Produk
            </h2>
            <button
              onClick={handleAddProduct}
              className="inline-flex items-center gap-1.5 rounded-lg bg-paroki-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-paroki-700"
            >
              <Plus className="h-4 w-4" />
              Tambah Produk
            </button>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ── Loading ── */}
          {productsLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-16 w-full rounded-lg bg-paroki-100" />
              <div className="h-16 w-full rounded-lg bg-paroki-100" />
              <div className="h-16 w-full rounded-lg bg-paroki-100" />
            </div>
          ) : products.length === 0 ? (
            /* ── Empty state ── */
            <div className="rounded-lg border border-dashed border-paroki-300 bg-white py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-paroki-50 text-paroki-400">
                <Package className="h-6 w-6" />
              </div>
              <p className="font-medium text-paroki-700">Belum ada produk</p>
              <p className="mt-1 text-sm text-paroki-400">
                Tambahkan produk pertama untuk usaha ini!
              </p>
            </div>
          ) : (
            <>
              {/* ═══ Desktop table ═══ */}
              <div className="hidden overflow-hidden rounded-xl border border-paroki-200 bg-white shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-paroki-200 bg-paroki-50 text-paroki-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Produk</th>
                      <th className="px-4 py-3 font-semibold">Tipe</th>
                      <th className="px-4 py-3 font-semibold">Harga</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Dilihat</th>
                      <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paroki-100">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-paroki-50/50">
                        {/* Thumbnail + Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-paroki-50">
                              {p.image_url ? (
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-paroki-300">
                                  <Package className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <span className="font-medium text-paroki-900">{p.name}</span>
                          </div>
                        </td>
                        {/* Type badge */}
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold ${
                              p.product_type === 'jasa'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-paroki-100 text-paroki-700'
                            }`}
                          >
                            {p.product_type === 'jasa' ? 'Jasa' : 'Produk'}
                          </span>
                        </td>
                        {/* Price */}
                        <td className="px-4 py-3 text-paroki-600">
                          {formatPrice(p.price, p.price_note)}
                        </td>
                        {/* Availability toggle */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleAvailable(p)}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                              p.is_available
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                            title={
                              p.is_available
                                ? 'Tersedia (klik untuk nonaktifkan)'
                                : 'Tidak tersedia (klik untuk aktifkan)'
                            }
                          >
                            {p.is_available ? 'Tersedia' : 'Nonaktif'}
                          </button>
                        </td>
                        {/* View count */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-paroki-500">
                            <Eye className="h-3.5 w-3.5" />
                            {idrFormatter.format(p.view_count)}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleEditProduct(p.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-paroki-200 px-2.5 py-1.5 text-xs font-medium text-paroki-700 hover:bg-paroki-50"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              disabled={deletingProductId === p.id}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {deletingProductId === p.id ? '...' : 'Hapus'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ═══ Mobile cards ═══ */}
              <div className="space-y-3 md:hidden">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-paroki-200 bg-white p-4 shadow-sm"
                  >
                    {/* Top: thumbnail + name + type */}
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-paroki-50">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-paroki-300">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-paroki-900">{p.name}</span>
                          <span
                            className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              p.product_type === 'jasa'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-paroki-100 text-paroki-700'
                            }`}
                          >
                            {p.product_type === 'jasa' ? 'Jasa' : 'Produk'}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-paroki-500">
                          <span>{formatPrice(p.price, p.price_note)}</span>
                          <span className="inline-flex items-center gap-0.5">
                            <Eye className="h-3 w-3" />
                            {idrFormatter.format(p.view_count)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: toggle + actions */}
                    <div className="mt-3 flex items-center justify-between border-t border-paroki-50 pt-3">
                      <button
                        onClick={() => handleToggleAvailable(p)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                          p.is_available
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {p.is_available ? 'Tersedia' : 'Nonaktif'}
                      </button>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleEditProduct(p.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-paroki-200 px-2.5 py-1.5 text-xs font-medium text-paroki-700 hover:bg-paroki-50"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingProductId === p.id}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingProductId === p.id ? '...' : 'Hapus'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
