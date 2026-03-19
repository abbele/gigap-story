import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
