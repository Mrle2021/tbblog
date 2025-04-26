const { execSync } = require('child_process');
const dayjs = require('dayjs');

try {
  // 只添加 source/_posts 下的改动
  execSync('git add source/_posts', { stdio: 'inherit' });

  // 检查是否有改动
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  if (status.trim().length > 0) {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    execSync(`git commit -m "更新博客内容：${now}"`, { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    console.log(`✅ 有改动，已成功推送：更新博客内容：${now}`);
  } else {
    console.log('⚡ 没有新的文章改动，无需推送。');
  }
} catch (err) {
  console.error('❌ 推送失败:', err.message);
}