import type {MetadataRoute} from 'next'

export default function manifest(): MetadataRoute.Manifest {
  const defaultAppName = process.env.SERVICE_SHORTNAME || 'etoN'

  return {
    name: `${process.env.SERVICE_NAME || defaultAppName} | PWA`,
    short_name: defaultAppName,
    description: 'A minimalistic note-taking app for everyone.',
    start_url: '/',
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'minimal-ui', 'standalone'],
    icons: [
      {
        src: '/web-app-manifest-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/web-app-manifest-1024x1024.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/note-list-mobile.png',
        sizes: '385x840',
        type: 'image/png',
        form_factor: 'narrow', // for mobile
      },
      {
        src: '/screenshots/note-list-desktop.png',
        sizes: '1386x1302',
        type: 'image/png',
        form_factor: 'wide', // for desktop
      },
    ],
  }
}
