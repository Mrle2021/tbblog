const { execFileSync } = require('child_process');

const host = process.env.VPS_HOST || '192.210.213.108';
const user = process.env.VPS_USER || 'root';
const port = process.env.VPS_PORT || '22';
const remoteDeploy = process.env.VPS_DEPLOY_SCRIPT || '/opt/tbblog/deploy.sh';

const target = `${user}@${host}`;

console.log(`Deploying blog on ${target}:${remoteDeploy}`);

execFileSync('ssh', [
  '-p',
  port,
  target,
  remoteDeploy
], {
  stdio: 'inherit'
});
