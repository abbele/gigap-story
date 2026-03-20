import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Turbopack (default Next.js 16): rispetta il campo "browser" di @xenova/transformers
  // nativamente, quindi sharp e onnxruntime-node sono già esclusi dal bundle browser.
  turbopack: {},
  // Webpack (flag --webpack): alias espliciti come fallback per versioni webpack
  // che non processano correttamente il campo "browser" del package.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      'onnxruntime-node$': false,
    };
    return config;
  },
  images: {
    // UX: consentiamo le immagini IIIF dai server dei musei partner
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.artic.edu',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'iiif.micr.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'iiif.wellcomecollection.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.collections.yale.edu',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
