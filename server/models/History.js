const mongoose = require("mongoose");

const RuleResultSchema = new mongoose.Schema(
  {
    passed: Boolean,
    failures: [String],
    rulesChecked: Number,
  },
  { _id: false }
);

const InsightDetailSchema = new mongoose.Schema(
  {
    message: String,
    category: String,
    severity: { type: String, enum: ["high", "medium", "low"] },
  },
  { _id: false }
);

const TestResultSchema = new mongoose.Schema(
  {
    testName: String,
    status: { type: String, enum: ["Passed", "Failed"] },
    statusCode: Number,
    responseTime: Number,
    responseSize: Number,
    errorMessage: String,
    errorType: String,
    ruleResult: RuleResultSchema,
    insights: [String],
    insightDetails: [InsightDetailSchema],
    severity: { type: String, enum: ["high", "medium", "low"], default: null },
    debug: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const HistorySchema = new mongoose.Schema({
  url: { type: String, required: true },
  method: { type: String, required: true, enum: ["GET", "POST", "PUT", "DELETE"] },
  requestBody: { type: mongoose.Schema.Types.Mixed, default: null },
  headers: { type: mongoose.Schema.Types.Mixed, default: {} },
  response: { type: mongoose.Schema.Types.Mixed, default: null },
  responseHeaders: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ["Passed", "Failed"], required: true },
  statusCode: { type: Number },
  responseTime: { type: Number },
  responseSize: { type: Number },
  errorMessage: { type: String },
  rulesUsed: { type: mongoose.Schema.Types.Mixed, default: null },
  ruleResults: { type: RuleResultSchema, default: null },
  insights: [String],
  severity: { type: String, enum: ["high", "medium", "low"], default: null },
  testResults: [TestResultSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("History", HistorySchema);
