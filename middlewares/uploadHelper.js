const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const upload = multer({ storage: multer.memoryStorage() });

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const toWebp = async (buffer, destDir, filename) => {
    ensureDir(destDir);
    const outPath = path.join(destDir, filename);
    await sharp(buffer).webp({ quality: 80 }).toFile(outPath);
    return { filename, path: outPath };
};

const convertFields = (dirs) => async (req, res, next) => {
    try {
        if (!req.files) return next();
        const filesArr = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
        for (const file of filesArr) {
            const destDir = dirs[file.fieldname] || dirs["default"];
            if (!destDir) continue;
            const filename = Date.now() + "_" + Math.random().toString(36).slice(2) + ".webp";
            const result = await toWebp(file.buffer, destDir, filename);
            file.filename = result.filename;
            file.path = result.path;
        }
        next();
    } catch (e) { next(e); }
};

const convertSingle = (destDir) => async (req, res, next) => {
    try {
        if (!req.file) return next();
        const filename = Date.now() + ".webp";
        const result = await toWebp(req.file.buffer, destDir, filename);
        req.file.filename = result.filename;
        req.file.path = result.path;
        next();
    } catch (e) { next(e); }
};

module.exports = { upload, convertFields, convertSingle, ensureDir };
