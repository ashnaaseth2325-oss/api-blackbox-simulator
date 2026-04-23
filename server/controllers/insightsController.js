const History = require("../models/History");

const getInsights = async (req, res) => {
  try {
    const [commonIssues, unstableEndpoints, slowestEndpoints, severityBreakdown] =
      await Promise.all([

        // Most frequently occurring insight messages across all test runs
        History.aggregate([
          { $unwind: "$testResults" },
          { $unwind: "$testResults.insights" },
          {
            $group: {
              _id: "$testResults.insights",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, issue: "$_id", count: 1 } },
        ]),

        // Endpoints with the highest failure rate (require ≥ 2 runs for statistical significance)
        History.aggregate([
          {
            $group: {
              _id: "$url",
              total: { $sum: 1 },
              failed: {
                $sum: { $cond: [{ $eq: ["$status", "Failed"] }, 1, 0] },
              },
              avgResponseTime: { $avg: "$responseTime" },
              severities: { $push: "$severity" },
            },
          },
          { $match: { total: { $gte: 2 } } },
          {
            $addFields: {
              failureRate: {
                $round: [
                  { $multiply: [{ $divide: ["$failed", "$total"] }, 100] },
                  1,
                ],
              },
              avgResponseTime: { $round: ["$avgResponseTime", 0] },
            },
          },
          { $match: { failureRate: { $gt: 0 } } },
          { $sort: { failureRate: -1 } },
          { $limit: 5 },
          {
            $project: {
              _id: 0,
              endpoint: "$_id",
              total: 1,
              failed: 1,
              failureRate: 1,
              avgResponseTime: 1,
            },
          },
        ]),

        // Endpoints with the highest average response time
        History.aggregate([
          {
            $group: {
              _id: "$url",
              avgResponseTime: { $avg: "$responseTime" },
              maxResponseTime: { $max: "$responseTime" },
              total: { $sum: 1 },
            },
          },
          {
            $addFields: {
              avgResponseTime: { $round: ["$avgResponseTime", 0] },
            },
          },
          { $sort: { avgResponseTime: -1 } },
          { $limit: 5 },
          {
            $project: {
              _id: 0,
              endpoint: "$_id",
              avgResponseTime: 1,
              maxResponseTime: 1,
              total: 1,
            },
          },
        ]),

        // Distribution of severity levels across all test runs
        History.aggregate([
          { $match: { severity: { $ne: null } } },
          { $group: { _id: "$severity", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { _id: 0, severity: "$_id", count: 1 } },
        ]),
      ]);

    return res.json({
      success: true,
      data: {
        commonIssues,
        unstableEndpoints,
        slowestEndpoints,
        severityBreakdown,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to compute insights",
      details: err.message,
    });
  }
};

module.exports = { getInsights };
