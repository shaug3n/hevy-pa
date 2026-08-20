/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@hevy-pa/hevy-mcp'],
  outputFileTracingIncludes: { '/api/chat': ['./prompts/coach-instructions.md'] },
};
export default nextConfig;
