/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"]
    },
    // @napi-rs/canvas ships a native .node binary (used to rasterize Chinese kitchen-ticket
    // text — see lib/cjk-render.ts). Webpack cannot bundle native addons, so this keeps it
    // external and let Node's own require() load it directly from node_modules at runtime.
    serverComponentsExternalPackages: ["@napi-rs/canvas"]
  }
};

export default nextConfig;
