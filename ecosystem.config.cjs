// PM2 ecosystem config — used for local production runs
// Start with: npx pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'aqua-hub-api',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 10000,
        DATABASE_PATH: './aqua_hub.db',
        CORS_ORIGINS: 'https://fisheries-intelligent-hub.vercel.app',
      },
    },
  ],
};
