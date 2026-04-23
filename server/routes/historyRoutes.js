const express = require("express");
const {
  getHistory,
  deleteHistoryById,
  clearAllHistory,
  exportHistory,
} = require("../controllers/historyController");

const router = express.Router();

// Order matters: /export must come before /:id to avoid being swallowed
router.get("/export", exportHistory);
router.get("/", getHistory);
router.delete("/:id", deleteHistoryById);
router.delete("/", clearAllHistory);

module.exports = router;
