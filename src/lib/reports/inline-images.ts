import fs from 'fs';
import path from 'path';
import { getCompanySettings, getLogoAsset } from '@/lib/app-settings';

/**
 * Inlines relative image URLs (such as /api/assets/logo:... and /uploads/...)
 * as self-contained Base64 data URIs, so that Headless Chromium rendering a
 * detached document can show the logo and images without needing a network
 * roundtrip or session cookies.
 *
 * Shared by the browser-POST path and the headless print path.
 */
export async function inlineImagesInHtml(html: string): Promise<string> {
  let result = html;

  // 1. Scan for all img src attributes
  const srcMatches = Array.from(html.matchAll(/src=["']([^"']+)["']/g));
  for (const match of srcMatches) {
    const src = match[1];
    if (src.startsWith('data:')) continue;

    try {
      if (src.includes('/api/assets/')) {
        const rawKey = src.split('/api/assets/')[1]?.split('?')[0]?.split('#')[0] || '';
        const decodedKey = decodeURIComponent(rawKey);
        const asset = await getLogoAsset(decodedKey);
        if (asset?.mime && asset?.data) {
          const dataUri = `data:${asset.mime};base64,${asset.data}`;
          result = result.replaceAll(src, dataUri);
          continue;
        }
      }

      if (src.startsWith('/uploads/') || src.includes('/uploads/')) {
        const cleanPath = src.split('?')[0]?.split('#')[0] || '';
        const relativeUpload = cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath;
        const filePath = path.join(process.cwd(), 'public', relativeUpload);
        if (fs.existsSync(filePath)) {
          const bytes = await fs.promises.readFile(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mime =
            ext === '.svg'
              ? 'image/svg+xml'
              : ext === '.jpg' || ext === '.jpeg'
                ? 'image/jpeg'
                : 'image/png';
          result = result.replaceAll(src, `data:${mime};base64,${bytes.toString('base64')}`);
          continue;
        }
      }
    } catch (err) {
      console.warn('inlineImagesInHtml failed for src:', src, err);
    }
  }

  // 2. Cross-reference company logo URL in database settings
  try {
    const company = await getCompanySettings();
    if (company.logoUrl && company.logoUrl.includes('/api/assets/')) {
      const rawKey = company.logoUrl.split('/api/assets/')[1]?.split('?')[0]?.split('#')[0] || '';
      const decodedKey = decodeURIComponent(rawKey);
      const asset = await getLogoAsset(decodedKey);
      if (asset?.mime && asset?.data) {
        const dataUri = `data:${asset.mime};base64,${asset.data}`;
        result = result.replaceAll(company.logoUrl, dataUri);
        result = result.replaceAll(decodeURIComponent(company.logoUrl), dataUri);
        result = result.replaceAll(encodeURI(company.logoUrl), dataUri);
      }
    }
  } catch (err) {
    console.warn('inlineImagesInHtml company logo check error:', err);
  }

  return result;
}
