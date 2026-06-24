/** @type {import('next').NextConfig} */
const nextConfig = {
  // The SDK ships as a workspace package, so let Next transpile it from source
  // instead of expecting a prebuilt browser bundle.
  transpilePackages: ["@flock-sdk/react", "@flock-sdk/core"],
};

export default nextConfig;
