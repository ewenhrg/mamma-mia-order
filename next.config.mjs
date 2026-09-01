/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js'],
    // Next 15 met 0s par defaut : chaque tap refetchait la page.
    // 30s : retour salle / meme table = instantane. Realtime rafraichit ensuite.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
