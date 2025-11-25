/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone é CRÍTICO para Docker (reduz tamanho da imagem drasticamente)
  output: 'standalone', 
};

module.exports = nextConfig;