const { execSync } = require('child_process');
const dayjs = require('dayjs');

function run(cmd, options = {}) {
  return execSync(cmd, { stdio: 'inherit', ...options });
}

function commitAndPushSubmodules() {
  // 获取子模块路径列表（此例假设只有 themes/next，可拓展）
  const submodules = ['themes/next'];

  submodules.forEach(path => {
    try {
      console.log(`📂 正在处理子模块 ${path} ...`);
      process.chdir(path);
      run('git add -A');

      const status = execSync('git status --porcelain', { encoding: 'utf8' });

      if (status.trim().length > 0) {
        const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
        run(`git commit -m "子模块更新：${now}"`);
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        run(`git push origin ${branch}`);
        console.log(`✅ 子模块 ${path} 已提交并推送`);
      } else {
        console.log(`⚡ 子模块 ${path} 没有改动`);
      }

    } finally {
      // 回到主目录
      process.chdir('../../');
    }
  });
}

try {
  // 提交子模块变更
  commitAndPushSubmodules();

  // 提交主项目（含子模块引用变动）
  console.log('📦 正在提交主仓库...');
  run('git add -A');

  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  if (status.trim().length > 0) {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    run(`git commit -m "更新博客内容：${now}"`);
    run('git push origin HEAD');

    // 构建并部署 Hexo 博客页面
    console.log('🚀 正在构建并部署 Hexo 博客...');
    run('npx hexo clean && npx hexo generate && npx hexo deploy');

    console.log(`✅ 博客内容已更新并部署成功：${now}`);
  } else {
    console.log('⚡ 没有主仓库的改动，无需提交。');
  }

} catch (err) {
  console.error('❌ 发布失败:', err.message);
}