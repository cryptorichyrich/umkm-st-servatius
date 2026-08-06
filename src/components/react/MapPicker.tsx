import { useEffect, useRef, useState } from 'react';

// Open-source map picker using Leaflet + OpenStreetMap tiles
// Dynamically loads Leaflet CSS+JS from CDN (no npm install needed)
// Returns lat/lng to parent

interface Props {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}

// Default center: Jakarta area (will be refined by geolocation or search)
const DEFAULT_LAT = -6.2088;
const DEFAULT_LNG = 106.8456;

export default function MapPicker({ latitude, longitude, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // Load Leaflet CSS + JS once
  useEffect(() => {
    // Already loaded?
    if ((window as any).L) { setLoaded(true); return; }

    // CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);

    return () => {
      // Cleanup on unmount: destroy map
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Init map when Leaflet is loaded
  useEffect(() => {
    if (!loaded || !containerRef.current || mapRef.current) return;

    const L = (window as any).L;
    const lat = latitude ?? DEFAULT_LAT;
    const lng = longitude ?? DEFAULT_LNG;

    const map = L.map(containerRef.current).setView([lat, lng], latitude ? 16 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // Draggable marker
    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChange(pos.lat, pos.lng);
    });

    // Click to move marker
    map.on('click', (e: any) => {
      marker.setLatLng(e.latlng);
      onChange(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Fix size issue after render
    setTimeout(() => map.invalidateSize(), 100);
  }, [loaded]);

  // Update marker when lat/lng changes externally
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (latitude !== null && longitude !== null) {
      const L = (window as any).L;
      markerRef.current.setLatLng([latitude, longitude]);
      mapRef.current.panTo([latitude, longitude]);
    }
  }, [latitude, longitude]);

  // ── Nominatim search (OpenStreetMap geocoding, free) ──
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=id`,
        { headers: { 'Accept-Language': 'id' } }
      );
      const data = await res.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        onChange(lat, lng);
        const L = (window as any).L;
        markerRef.current?.setLatLng([lat, lng]);
        mapRef.current?.setView([lat, lng], 17);
      } else {
        alert('Lokasi tidak ditemukan. Coba ketik nama jalan, kelurahan, atau kecamatan.');
      }
    } catch {
      alert('Gagal mencari lokasi. Periksa koneksi internet.');
    } finally {
      setSearching(false);
    }
  };

  // ── Use device GPS ──
  const useMyLocation = () => {
    if (!navigator.geolocation) { alert('GPS tidak tersedia di perangkat ini.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        onChange(lat, lng);
        markerRef.current?.setLatLng([lat, lng]);
        mapRef.current?.setView([lat, lng], 17);
      },
      () => alert('Gagal mengakses GPS. Pastikan izin lokasi diberikan.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari alamat/kelurahan/kecamatan..."
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-200"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-lg bg-paroki-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-paroki-900 disabled:opacity-50"
        >
          {searching ? '...' : 'Cari'}
        </button>
      </form>

      {/* Map container */}
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-xl border border-gray-200"
        style={{ zIndex: 0 }}
      />

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={useMyLocation}
          className="flex items-center gap-1.5 rounded-lg border border-paroki-300 bg-white px-3 py-1.5 text-xs font-medium text-paroki-800 transition hover:bg-paroki-50"
        >
          📍 Gunakan Lokasi Saya
        </button>
        {latitude !== null && longitude !== null && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-mono">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </span>
            <button
              type="button"
              onClick={() => onChange(0, 0)}
              className="text-red-400 hover:underline"
            >
              Hapus
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">
        Klik peta atau geser pin untuk mengatur lokasi. Atau cari alamat di kotak pencarian.
      </p>
    </div>
  );
}
