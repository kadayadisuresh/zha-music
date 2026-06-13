/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
const ColorThief = require('colorthief');

const ALLOWED_HOSTS = [
  'lh3.googleusercontent.com',
  'i.ytimg.com',
  'yt3.ggpht.com',
  'yt3.googleusercontent.com'
];

function isValidUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.some(host => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  if (!isValidUrl(imageUrl)) {
    return new NextResponse('Invalid or untrusted URL', { status: 403 });
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    let dominantColorHex = '#121212'; // Default dark
    try {
      // ColorThief.getColor requires 'sharp' to be installed.
      // If it fails, we silently fall back to the default color.
      const color = await ColorThief.getColor(buffer);
      if (color) {
        dominantColorHex = rgbToHex(color[0], color[1], color[2]);
      }
    } catch {
      // Color extraction is optional — sharp may not be installed.
      // Silently fall back to default color.
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'X-Dominant-Color': dominantColorHex,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('[Image Proxy] Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
