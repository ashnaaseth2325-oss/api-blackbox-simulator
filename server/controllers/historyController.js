const mongoose = require("mongoose");
const History = require("../models/History");
const { Parser } = require("json2csv");

const getHistory = async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;
    const filter = status && status !== "All" ? { status } : {};
    const history = await History.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();
    res.json({ success: true, count: history.length, data: history });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch history", details: err.message });
  }
};

const deleteHistoryById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid record ID" });
    }
    const deleted = await History.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    res.json({ success: true, message: "Record deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete record", details: err.message });
  }
};

const clearAllHistory = async (req, res) => {
  try {
    const result = await History.deleteMany({});
    res.json({ success: true, message: `Cleared ${result.deletedCount} records` });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to clear history", details: err.message });
  }
};

const exportHistory = async (req, res) => {
  try {
    const { format = "json" } = req.query;
    const history = await History.find({}).sort({ createdAt: -1 }).lean();

    if (format === "csv") {
      const fields = [
        "url",
        "method",
        "status",
        "statusCode",
        "responseTime",
        "responseSize",
        "errorMessage",
        "createdAt",
      ];
      const parser = new Parser({ fields });
      const csv = parser.parse(history);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=api-history.csv");
      return res.send(csv);
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=api-history.json");
    return res.send(JSON.stringify(history, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, message: "Export failed", details: err.message });
  }
};

module.exports = { getHistory, deleteHistoryById, clearAllHistory, exportHistory };
