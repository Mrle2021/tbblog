const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');

const IMAGE_LIMIT = 1024 * 1024;
const THUMB_LIMIT = 64 * 1024;

function isJpeg(filePath) {
  return ['.jpg', '.jpeg'].includes(path.extname(filePath).toLowerCase());
}

function isPng(filePath) {
  return path.extname(filePath).toLowerCase() === '.png';
}

function makeTempPath(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  return path.join(dir, 'image.jpg');
}

async function writeJpegUnderLimit(inputPath, outputPath, {
  maxWidth,
  maxHeight,
  sizeLimit,
  startQuality
}) {
  for (const quality of [startQuality, 82, 74, 66, 58, 50, 42, 34]) {
    await sharp(inputPath)
      .rotate()
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality, mozjpeg: true })
      .toFile(outputPath);

    if (fs.statSync(outputPath).size <= sizeLimit) return;
  }

  throw new Error(`Unable to prepare image under ${sizeLimit} bytes: ${inputPath}`);
}

async function prepareWechatImage(filePath, { kind }) {
  if (kind === 'image' && (isJpeg(filePath) || isPng(filePath)) && fs.statSync(filePath).size <= IMAGE_LIMIT) {
    return { path: filePath, temporary: false };
  }

  if (kind === 'thumb' && isJpeg(filePath) && fs.statSync(filePath).size <= THUMB_LIMIT) {
    return { path: filePath, temporary: false };
  }

  const outputPath = makeTempPath(`wechat-${kind}`);
  await writeJpegUnderLimit(filePath, outputPath, {
    maxWidth: kind === 'thumb' ? 600 : 1280,
    maxHeight: kind === 'thumb' ? 600 : 1280,
    sizeLimit: kind === 'thumb' ? THUMB_LIMIT : IMAGE_LIMIT,
    startQuality: kind === 'thumb' ? 80 : 86
  });

  return { path: outputPath, temporary: true };
}

function cleanupPreparedImages(preparedImages) {
  for (const prepared of preparedImages) {
    if (!prepared?.temporary) continue;
    try {
      fs.rmSync(path.dirname(prepared.path), { recursive: true, force: true });
    } catch {
      // Best-effort cleanup only.
    }
  }
}

module.exports = {
  cleanupPreparedImages,
  prepareWechatImage
};
