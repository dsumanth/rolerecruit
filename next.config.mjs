/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/dashboard/team",
        destination: "/dashboard/settings/team",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
