const { execSync } = require('child_process');
const dayjs = require('dayjs');

try {
  // 添加所有更改（包括新文件和子模块变更）
  execSync('git add -A', { stdio: 'inherit' });

  // 检查是否有改动
  const status = execSync('git status --porcelain', { encoding: 'utf8' });

  if (status.trim().length > 0) {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    execSync(`git commit -m "更新博客内容：${now}"`, { stdio: 'inherit' });
    execSync('git push origin main', { stdio: 'inherit' });

    // 构建并部署 hexo 博客页面
    execSync('npx hexo clean && npx hexo generate && npx hexo deploy', { stdio: 'inherit' });

    console.log(`✅ 博客内容已更新并部署成功：${now}`);
  } else {
    console.log('⚡ 没有新的改动，无需提交或部署。');
  }
} catch (err) {
  console.error('❌ 发布失败:', err.message);
}