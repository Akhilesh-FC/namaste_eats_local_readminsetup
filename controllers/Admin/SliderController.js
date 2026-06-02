const sequelize = require("../../config/db");
const { QueryTypes } = require("sequelize");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SLIDER_DIR = path.join(__dirname, "../../public/uploads/sliders");
if (!fs.existsSync(SLIDER_DIR)) fs.mkdirSync(SLIDER_DIR, { recursive: true });

const upload = multer({ storage: multer.memoryStorage() }).single("image");

const saveWebp = async (buffer) => {
    const filename = Date.now() + ".webp";
    const outPath = path.join(SLIDER_DIR, filename);
    await sharp(buffer).webp({ quality: 80 }).toFile(outPath);
    return filename;
};

const deleteFile = (imageUrl) => {
    if (!imageUrl) return;
    try {
        const urlPath = new URL(imageUrl).pathname;
        const filePath = path.join(__dirname, "../../public", urlPath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) {}
};

// List with pagination + search
exports.index = async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page) || 1);
        const limit  = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search ? req.query.search.trim() : "";

        const where = search ? `WHERE title LIKE :s OR description LIKE :s` : "";
        const replacements = search ? { s: `%${search}%`, limit, offset } : { limit, offset };

        const [{ total }] = await sequelize.query(
            `SELECT COUNT(*) as total FROM sliders ${where}`,
            { replacements, type: QueryTypes.SELECT }
        );

        const sliders = await sequelize.query(
            `SELECT * FROM sliders ${where} ORDER BY id DESC LIMIT :limit OFFSET :offset`,
            { replacements, type: QueryTypes.SELECT }
        );

        res.render("sliders/index", { sliders, currentPage: page, totalPages: Math.ceil(total / limit), search });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};

// Store
exports.store = (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(400).send("Upload failed: " + err.message);
        const { title, description } = req.body;
        if (!title) return res.status(400).send("Title required");

        let image = null;
        if (req.file) {
            const filename = await saveWebp(req.file.buffer);
            image = `${process.env.BASE_URL}uploads/sliders/${filename}`;
        }

        try {
            await sequelize.query(
                "INSERT INTO sliders (title, description, image, status, created_at, updated_at) VALUES (:title, :description, :image, 'active', NOW(), NOW())",
                { replacements: { title, description, image }, type: QueryTypes.INSERT }
            );
            res.redirect("/sliders");
        } catch (e) {
            console.error(e);
            res.status(500).send("DB Error: " + e.message);
        }
    });
};

// Update (AJAX)
exports.update = (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.json({ success: false, message: "Upload failed" });
        const { id, title, description } = req.body;
        try {
            if (req.file) {
                // Delete old image first
                const [old] = await sequelize.query(
                    "SELECT image FROM sliders WHERE id=:id LIMIT 1",
                    { replacements: { id }, type: QueryTypes.SELECT }
                );
                deleteFile(old?.image);

                const filename = await saveWebp(req.file.buffer);
                const image = `${process.env.BASE_URL}uploads/sliders/${filename}`;
                await sequelize.query(
                    "UPDATE sliders SET title=:title, description=:description, image=:image, updated_at=NOW() WHERE id=:id",
                    { replacements: { title, description, image, id }, type: QueryTypes.UPDATE }
                );
            } else {
                await sequelize.query(
                    "UPDATE sliders SET title=:title, description=:description, updated_at=NOW() WHERE id=:id",
                    { replacements: { title, description, id }, type: QueryTypes.UPDATE }
                );
            }
            res.json({ success: true });
        } catch (e) {
            res.json({ success: false, message: e.message });
        }
    });
};

// Toggle status (AJAX)
exports.toggleStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const [slider] = await sequelize.query(
            "SELECT status FROM sliders WHERE id=:id",
            { replacements: { id }, type: QueryTypes.SELECT }
        );
        if (!slider) return res.json({ success: false });
        const newStatus = slider.status === "active" ? "inactive" : "active";
        await sequelize.query(
            "UPDATE sliders SET status=:status, updated_at=NOW() WHERE id=:id",
            { replacements: { status: newStatus, id }, type: QueryTypes.UPDATE }
        );
        res.json({ success: true, newStatus });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
};

// Delete (AJAX)
exports.delete = async (req, res) => {
    const { id } = req.params;
    try {
        const [slider] = await sequelize.query(
            "SELECT image FROM sliders WHERE id=:id LIMIT 1",
            { replacements: { id }, type: QueryTypes.SELECT }
        );

        await sequelize.query(
            "DELETE FROM sliders WHERE id=:id",
            { replacements: { id }, type: QueryTypes.DELETE }
        );

        deleteFile(slider?.image);

        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
};
