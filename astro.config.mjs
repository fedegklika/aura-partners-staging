import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://aura-partners.com',
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing']
    }
  },
  build: {
    assets: 'assets/build',
    inlineStylesheets: 'auto'
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport'
  }
});
