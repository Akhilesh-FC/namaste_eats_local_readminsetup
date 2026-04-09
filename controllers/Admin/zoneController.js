const Zone = require("../../models/Zone");
const { Op } = require("sequelize");

exports.list = async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const where = search ? { zone_name: { [Op.like]: `%${search}%` } } : {};

    const { count, rows: zones } = await Zone.findAndCountAll({
        where,
        order: [["id", "DESC"]],
        limit,
        offset
    });

    const totalPages = Math.ceil(count / limit);
    res.render("zones/list", { zones, page, totalPages, search });
};


exports.createPage = async (req, res) => {
    res.render("zones/create");
};

exports.store = async (req, res) => {
    try {
        const { zone_name, coordinates } = req.body;

        if (!zone_name || !coordinates) {
            return res.json({ status: false, message: "Zone name and coordinates required" });
        }

        await Zone.create({
            zone_name,
            coordinates: JSON.stringify(coordinates)
        });

        res.json({ status: true, message: "Zone saved successfully" });
    } catch (error) {
        console.log(error);
        res.json({ status: false, message: "Error saving zone" });
    }
};

exports.toggle = async (req, res) => {
    try {
        const zone = await Zone.findByPk(req.params.id);

        if (!zone) {
            return res.json({ status: false, message: "Zone not found" });
        }

        zone.is_active = zone.is_active === 1 ? 0 : 1;
        await zone.save();

        res.json({ status: true, zone });
    } catch (error) {
        res.json({ status: false, message: "Error updating" });
    }
};

exports.deleteZone = async (req, res) => {
    try {
        const zone = await Zone.findByPk(req.params.id);
        if (!zone) return res.json({ status: false, message: "Zone not found" });
        await zone.destroy();
        res.json({ status: true, message: "Zone deleted" });
    } catch (error) {
        res.json({ status: false, message: "Error deleting zone" });
    }
};
