import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  turbopack: {},
  outputFileTracingIncludes: {
    "/api/cms/products": ["./data/cms/**/*"],
    "/api/cms/vehicles": ["./data/cms/**/*"],
    "/api/cms/quote-config": ["./data/cms/**/*"],
    "/api/cms/hotspots": ["./data/cms/**/*"],
  },
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/assets/glb/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Content-Type",
            value: "model/gltf-binary",
          },
        ],
      },
      {
        source: "/basis/:path*.wasm",
        headers: [
          {
            key: "Content-Type",
            value: "application/wasm",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/basis/:path*.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
