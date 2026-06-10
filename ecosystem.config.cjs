module.exports = {
  apps: [{
    name: 'did-demo',
    script: 'server.js',
    node_args: '--env-file=.env',
    env: {
      PORT: 3000,
    },
  }],
};
