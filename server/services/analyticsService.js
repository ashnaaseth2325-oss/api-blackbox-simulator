const History = require("../models/History");

const getGlobalStats = async () => {
  const [stats] = await History.aggregate([
    {
      $group: {
        _id: null,
        totalTests: { $sum: 1 },
        passedTests: { $sum: { $cond: [{ $eq: ["$status", "Passed"] }, 1, 0] } },
        failedTests: { $sum: { $cond: [{ $eq: ["$status", "Failed"] }, 1, 0] } },
        avgResponseTime: { $avg: "$responseTime" },
        minResponseTime: { $min: "$responseTime" },
        maxResponseTime: { $max: "$responseTime" },
      },
    },
  ]);
  return stats || null;
};

const getPerEndpointStats = async () => {
  return History.aggregate([
    {
      $group: {
        _id: "$url",
        total: { $sum: 1 },
        passed: { $sum: { $cond: [{ $eq: ["$status", "Passed"] }, 1, 0] } },
        avgTime: { $avg: "$responseTime" },
        lastTested: { $max: "$createdAt" },
      },
    },
    {
      $addFields: {
        failed: { $subtract: ["$total", "$passed"] },
        successRate: {
          $round: [
            { $multiply: [{ $divide: ["$passed", "$total"] }, 100] },
            1,
          ],
        },
        avgTime: { $round: ["$avgTime", 0] },
      },
    },
    {
      $project: {
        _id: 0,
        endpoint: "$_id",
        total: 1,
        passed: 1,
        failed: 1,
        successRate: 1,
        avgTime: 1,
        lastTested: 1,
      },
    },
    { $sort: { total: -1 } },
    { $limit: 10 },
  ]);
};

const getTrendData = async () => {
  const records = await History.find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .select("url method status responseTime createdAt")
    .lean();
  // Return oldest-first so the trend renders left → right chronologically
  return records.reverse();
};

module.exports = { getGlobalStats, getPerEndpointStats, getTrendData };
