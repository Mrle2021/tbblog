// scripts/add_slug.js

const fs = require('fs');
const path = require('path');
const slugify = require('slugify');

// 确保是从 scripts/ 回到项目根目录
const postsDir = path.join(__dirname, '..', 'source', '_posts');

// 读取所有 Markdown 文件
fs.readdir(postsDir, (err, files) => {
  if (err) {
    console.error('读取目录失败:', err);
    return;
  }

  files
    .filter(file => path.extname(file) === '.md') // 只处理 .md 文件
    .forEach(file => {
      const filePath = path.join(postsDir, file);
      let content = fs.readFileSync(filePath, 'utf8');

      // 检查是否已有 slug
      if (/^slug:/m.test(content)) {
        console.log(`已存在 slug，跳过：${file}`);
        return;
      }

      // 提取 title
      const titleMatch = content.match(/^title:\s*(.*)/m);
      if (!titleMatch) {
        console.warn(`未找到 title，跳过：${file}`);
        return;
      }

      const title = titleMatch[1].trim();
      const slug = slugify(title, { lower: true, remove: /[*+~.()'"!:@，？、。《》【】]/g });

      // 插入 slug 在 title 后面
      content = content.replace(/^title:.*$/m, match => `${match}\nslug: ${slug}`);

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ 已添加 slug 到：${file}`);
    });
});