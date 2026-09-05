import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
  eslint: { ignoreDuringBuilds: false },
  // De ontwikkelindicator staat linksonder precies over de onderbalk heen,
  // wat het testen op een smal scherm in de weg zit.
  devIndicators: false,
};

export default nextConfig;
