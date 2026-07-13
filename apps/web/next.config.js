/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: ['@merlin/ui', 'react-tweet'],
  output: 'standalone', // Optimized for Docker
  async redirects() {
    return [
      {
        source: '/landing-pages/:id/edit',
        destination: '/landing-pages/edit/:id',
        permanent: false,
      },
    ];
  },
};
