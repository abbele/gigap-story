import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config) => {
    // AI: @xenova/transformers usa onnxruntime-web nel browser e onnxruntime-node in Node.
    // Webpack deve ignorare i binding nativi Node.js — il campo "browser" in package.json
    // di @xenova/transformers non è sufficiente con alcune versioni di webpack.
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
