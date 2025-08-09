module.exports = {
  apps: [{
    name: 'video-transcription-app',
    script: './server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    // Graceful shutdown
    kill_timeout: 5000,
    // Restart delay
    restart_delay: 4000,
    // Max restart attempts
    max_restarts: 10,
    // Restart if memory exceeds this
    max_memory_restart: '2G',
    // Environment variables from .env file
    env_file: './.env'
  }]
};
