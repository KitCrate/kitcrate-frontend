/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@kitcrate/sdk"],
  agentRules: false,
};

module.exports = nextConfig;
