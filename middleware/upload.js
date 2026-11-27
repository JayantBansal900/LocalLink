import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'issues');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// The saved extension is derived from the validated MIME type, never from the
// client-supplied file name, so an upload can never be served as HTML/JS/SVG.
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = MIME_EXTENSIONS[file.mimetype.toLowerCase()] || '.img';
    const safeName = `ISSUE-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  if (MIME_EXTENSIONS[file.mimetype.toLowerCase()]) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image file format. Only JPG, JPEG, PNG, and WEBP formats are allowed.'));
  }
};

export const issueUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  }
});

// Checks the file's real content (magic bytes), since the MIME type is client-controlled.
function hasImageSignature(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(12);
    const read = fs.readSync(fd, buf, 0, 12, 0);
    if (read < 4) return false;
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp = read >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
    return isJpeg || isPng || isWebp;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function removeUploadedFile(file) {
  if (file && file.path) {
    fs.unlink(file.path, () => {});
  }
}

export const handleIssueUpload = (req, res, next) => {
  issueUpload.single('image')(req, res, (err) => {
    if (err) {
      removeUploadedFile(req.file);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Image size exceeds maximum limit of 5MB. Please upload a smaller image.'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Image upload validation error'
      });
    }

    if (req.file && !hasImageSignature(req.file.path)) {
      removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: 'The uploaded file is not a valid JPG, PNG, or WEBP image.'
      });
    }

    next();
  });
};
