import { defineConfig, type Preset } from '@vite-pwa/assets-generator/config';

/** Lo invoca scripts/generate-icons.mjs una vez por variante (cada una parte de un SVG distinto). */
const none = { sizes: [] };

const variants: Record<string, { image: string; preset: Preset }> = {
  app: {
    image: 'public/brand/logo.svg',
    preset: { transparent: { sizes: [192, 512], padding: 0 }, maskable: none, apple: none },
  },
  maskable: {
    image: 'pwa-assets/maskable.svg',
    preset: {
      transparent: none,
      maskable: { sizes: [512], padding: 0 },
      apple: { sizes: [180], padding: 0 },
    },
  },
  favicon: {
    image: 'pwa-assets/favicon.svg',
    preset: {
      transparent: { sizes: [], padding: 0, favicons: [[32, 'favicon.ico']] },
      maskable: none,
      apple: none,
    },
  },
};

const name = process.env.ICON_VARIANT ?? '';
const variant = variants[name];
if (!variant) throw new Error(`ICON_VARIANT desconocida: «${name}»`);

export default defineConfig({ preset: variant.preset, images: [variant.image] });
