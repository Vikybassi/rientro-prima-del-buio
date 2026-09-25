import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * Icone dell'app installata, generate da public/icon.svg (npx pwa-assets-generator).
 * Il fondo aggiunto attorno alle icone "maskable" e Apple è color carta, come il disegno: niente bordi bianchi
 * quando il telefono ritaglia l'icona a cerchio o a goccia.
 */
const paper = { background: '#f5f2ea' };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // icon.svg è già a tutto quadrato con il disegno nella zona sicura: niente margine extra
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: paper },
    apple: { ...minimal2023Preset.apple, resizeOptions: paper },
  },
  images: ['public/icon.svg'],
});
