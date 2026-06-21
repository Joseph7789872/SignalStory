/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Node 24's undici uses private class fields webpack can't parse; externalize it.
    config.externals = [...(config.externals || []), "undici"];
    return config;
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }],
  },
};

module.exports = nextConfig;
