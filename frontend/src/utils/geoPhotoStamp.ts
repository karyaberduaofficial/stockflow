export interface GeoStampMetadata {
  fullName: string;
  employeeCode: string;
  roleLabel: string;
  attendanceTypeLabel: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  locationAddress: string;
}

export async function reverseGeocodeAddress(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat.toFixed(6)
    )}&lon=${encodeURIComponent(lng.toFixed(6))}&zoom=18&addressdetails=1&accept-language=id`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('Reverse geocode HTTP error');
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    if (data.display_name && data.display_name.trim().length > 4) {
      return data.display_name.trim();
    }
    const addr = data.address || {};
    const parts = [
      addr.road,
      addr.suburb || addr.village || addr.neighbourhood,
      addr.city_district || addr.district,
      addr.city || addr.town || addr.county,
      addr.state,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  } catch {
    // Graceful fallback below
  }
  return `Koordinat Terdeteksi (${lat.toFixed(6)}, ${lng.toFixed(6)}) — Indonesia`;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

/**
 * Draws the uploaded/captured photo onto an offscreen canvas and burns in a crisp,
 * tamper-evident StockFlow Zero-Blue Geo-Tag Watermark (Name, Role, WIB Timestamp,
 * GPS Coordinates + Accuracy, and Full Real-Time Street Address).
 */
export function renderGeoTaggedPhoto(
  source: HTMLImageElement | HTMLVideoElement,
  meta: GeoStampMetadata
): string {
  const srcW = source instanceof HTMLVideoElement ? source.videoWidth || 960 : source.naturalWidth || 960;
  const srcH = source instanceof HTMLVideoElement ? source.videoHeight || 720 : source.naturalHeight || 720;

  const maxW = 1080;
  const scale = srcW > maxW ? maxW / srcW : 1;
  const w = Math.max(480, Math.round(srcW * scale));
  const h = Math.max(360, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Draw base photo
  ctx.drawImage(source, 0, 0, w, h);

  const pad = Math.round(w * 0.032);
  const fontScale = Math.max(0.85, w / 920);

  // 2. Top-left StockFlow Geo-Verified Pill (Forest Pine #1B4332 — ZERO BLUE)
  const pillText = `STOCKFLOW GEO-VERIFIED  •  ${meta.attendanceTypeLabel.toUpperCase()}`;
  ctx.font = `700 ${Math.round(14 * fontScale)}px Inter, system-ui, sans-serif`;
  const pillW = ctx.measureText(pillText).width + Math.round(28 * fontScale);
  const pillH = Math.round(30 * fontScale);
  ctx.fillStyle = 'rgba(27, 67, 50, 0.92)';
  ctx.beginPath();
  ctx.roundRect(pad, pad, pillW, pillH, 999);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234, 179, 75, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#FAF8F5';
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, pad + Math.round(14 * fontScale), pad + pillH / 2 + 0.5);

  // 3. Bottom Espresso Scrim Bar with Real-Time Location & Address Watermark
  const addrFontSize = Math.round(15 * fontScale);
  ctx.font = `500 ${addrFontSize}px Inter, system-ui, sans-serif`;
  const addrLines = wrapLines(ctx, `Lokasi: ${meta.locationAddress}`, w - pad * 2 - 24, 3);

  const lineGap = Math.round(22 * fontScale);
  const boxH = Math.round((84 + addrLines.length * 22) * fontScale);
  const boxY = h - boxH - pad;

  ctx.fillStyle = 'rgba(28, 25, 23, 0.86)';
  ctx.beginPath();
  ctx.roundRect(pad, boxY, w - pad * 2, boxH, 14);
  ctx.fill();

  // Warm Terracotta/Ochre accent left stripe
  ctx.fillStyle = '#EAB34B';
  ctx.beginPath();
  ctx.roundRect(pad, boxY, 6, boxH, [14, 0, 0, 14]);
  ctx.fill();

  const textX = pad + 18;
  let curY = boxY + Math.round(24 * fontScale);

  // Employee Name + Role + NIP
  ctx.fillStyle = '#FAF8F5';
  ctx.font = `800 ${Math.round(18 * fontScale)}px "Plus Jakarta Sans", Inter, sans-serif`;
  ctx.fillText(`${meta.fullName}  •  ${meta.roleLabel} (${meta.employeeCode})`, textX, curY);

  // Real-time Timestamp + Exact GPS Coordinates
  curY += Math.round(24 * fontScale);
  ctx.fillStyle = '#EAB34B';
  ctx.font = `700 ${Math.round(14 * fontScale)}px "JetBrains Mono", monospace`;
  const accStr = meta.accuracyM !== null ? ` (±${Math.round(meta.accuracyM)}m)` : '';
  ctx.fillText(
    `GPS: ${meta.latitude.toFixed(6)}, ${meta.longitude.toFixed(6)}${accStr}   |   ${meta.capturedAt}`,
    textX,
    curY
  );

  // Full Reverse-Geocoded Real-Time Address
  curY += Math.round(24 * fontScale);
  ctx.fillStyle = '#E7E0D6';
  ctx.font = `500 ${addrFontSize}px Inter, system-ui, sans-serif`;
  for (const ln of addrLines) {
    ctx.fillText(ln, textX, curY);
    curY += lineGap;
  }

  return canvas.toDataURL('image/jpeg', 0.86);
}
