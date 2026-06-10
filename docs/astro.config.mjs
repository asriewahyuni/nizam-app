import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.kliknizam.app',
  integrations: [
    starlight({
      title: 'Nizam Docs',
      description: 'Dokumentasi produk, operasional, dan developer untuk Nizam ERP.',
      logo: {
        light: './src/assets/nizam-docs-wordmark.svg',
        dark: './src/assets/nizam-docs-wordmark.svg',
        alt: 'Nizam Docs'
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/asriewahyuni/nizam-app' }
      ],
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        { label: 'Home', link: '/' },
        {
          label: 'Start Here',
          items: [
            'guides/getting-started',
            'guides/product-map',
            'guides/core-concepts',
            'guides/docs-roadmap'
          ]
        },
        {
          label: 'Technical Reference',
          items: [{ autogenerate: { directory: 'reference' } }]
        }
      ]
    })
  ]
});
