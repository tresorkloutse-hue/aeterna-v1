/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Three Fiber needs transpilation
  transpilePackages: [
    'three',
    '@react-three/fiber',
    '@react-three/drei',
  ],

  // Headers de sécurité
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },

  // Images Supabase Storage
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lbsqwtosjlfqlcthswqw.supabase.co' },
    ],
  },

  // R3F requiert ceci pour les shaders GLSL
  webpack(config) {
    config.module.rules.push({
      test:    /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      use:     ['raw-loader', 'glslify-loader'],
    })
    return config
  },
}

export default nextConfig
