const requestService = require("../services/requestService");
const rulesEngine    = require("../services/rulesEngine");
const insightsEngine = require("../services/insightsEngine");
const History        = require("../models/History");

const PRESET_TESTS = [
  { name: "Empty Body",        data: {}                                                          },
  { name: "Null Values",       data: { test: null, value: null }                                 },
  { name: "Wrong Data Types",  data: { id: "not-a-number", count: "abc", active: 999 }           },
  { name: "Large Payload",     data: { text: "a".repeat(10000) }                                 },
  { name: "Invalid Endpoint",  data: {}, urlSuffix: "/invalid-endpoint-xyz-404"                  },
];

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

const maxSeverity = (severities) => {
  const valid = severities.filter(Boolean);
  if (!valid.length) return null;
  return valid.reduce((best, cur) =>
    (SEVERITY_ORDER[cur] ?? 3) < (SEVERITY_ORDER[best] ?? 3) ? cur : best
  );
};

const determineStatus = (result, isCustom, ruleResult) => {
  if (ruleResult && !ruleResult.passed) return "Failed";
  if (!result.success) return "Failed";
  if (isCustom) return result.statusCode >= 200 && result.statusCode < 300 ? "Passed" : "Failed";
  return result.statusCode < 500 ? "Passed" : "Failed";
};

const runTests = async (req, res) => {
  const { url, method = "GET", requestBody, headers, enabledTests, rules } = req.body;

  if (!url || !url.trim())
    return res.status(400).json({ success: false, message: "URL is required" });

  try { new URL(url); }
  catch { return res.status(400).json({ success: false, message: "Invalid URL format" }); }

  const upperMethod = method.toUpperCase();
  if (!["GET", "POST", "PUT", "DELETE"].includes(upperMethod))
    return res.status(400).json({ success: false, message: `Unsupported method: ${method}` });

  let parsedBody = null;
  if (requestBody !== null && requestBody !== undefined) {
    if (typeof requestBody === "string" && requestBody.trim()) {
      try { parsedBody = JSON.parse(requestBody); }
      catch { return res.status(400).json({ success: false, message: "Invalid JSON in request body" }); }
    } else if (typeof requestBody === "object") {
      parsedBody = requestBody;
    }
  }

  const parsedRules =
    rules && typeof rules === "object" && Object.keys(rules).length > 0 ? rules : null;

  const testResults = [];

  // ── Custom request ────────────────────────────────────────────────────────
  const customResult = await requestService.executeRequest(upperMethod, url, parsedBody, headers);
  const ruleResult   = rulesEngine.validate(customResult, parsedRules);
  const customInsight = insightsEngine.analyze({
    result: customResult,
    ruleResult,
    testName: "Custom Request",
    rules: parsedRules,
  });

  testResults.push({
    testName:       "Custom Request",
    status:         determineStatus(customResult, true, ruleResult),
    statusCode:     customResult.statusCode,
    responseTime:   customResult.responseTime,
    responseSize:   customResult.responseSize,
    errorMessage:   customResult.error,
    errorType:      customResult.errorType,
    ruleResult,
    insights:       customInsight.insights,
    insightDetails: customInsight.insightDetails,
    severity:       customInsight.severity,
    debug: {
      responseHeaders: customResult.responseHeaders,
      dataPreview:     customResult.dataPreview,
      payloadSent:     parsedBody,
    },
  });

  // ── Preset tests ──────────────────────────────────────────────────────────
  const activePresets = PRESET_TESTS.filter(
    (t) => !enabledTests || enabledTests.includes(t.name)
  );

  for (const preset of activePresets) {
    const testUrl = preset.urlSuffix ? url + preset.urlSuffix : url;
    const result  = await requestService.executeRequest(upperMethod, testUrl, preset.data, headers);
    const presetInsight = insightsEngine.analyze({
      result,
      ruleResult: null,
      testName: preset.name,
      rules: null,
    });

    testResults.push({
      testName:       preset.name,
      status:         determineStatus(result, false, null),
      statusCode:     result.statusCode,
      responseTime:   result.responseTime,
      responseSize:   result.responseSize,
      errorMessage:   result.error,
      errorType:      result.errorType,
      ruleResult:     null,
      insights:       presetInsight.insights,
      insightDetails: presetInsight.insightDetails,
      severity:       presetInsight.severity,
      debug: {
        responseHeaders: result.responseHeaders,
        dataPreview:     result.dataPreview,
        payloadSent:     preset.data,
      },
    });
  }

  const overallStatus   = testResults.every((t) => t.status === "Passed") ? "Passed" : "Failed";
  const overallSeverity = maxSeverity(testResults.map((t) => t.severity));
  const primary         = testResults[0];

  try {
    const historyEntry = await History.create({
      url,
      method:         upperMethod,
      requestBody:    parsedBody,
      headers:        headers || {},
      response:       customResult.data,
      responseHeaders: customResult.responseHeaders,
      status:         overallStatus,
      statusCode:     primary.statusCode,
      responseTime:   primary.responseTime,
      responseSize:   primary.responseSize,
      errorMessage:   primary.errorMessage,
      rulesUsed:      parsedRules,
      ruleResults:    ruleResult,
      insights:       customInsight.insights,
      severity:       overallSeverity,
      testResults,
    });

    return res.json({
      success: true,
      historyId: historyEntry._id,
      url,
      method: upperMethod,
      overallStatus,
      overallSeverity,
      testResults,
    });
  } catch (dbErr) {
    return res.json({
      success: true,
      historyId: null,
      url,
      method: upperMethod,
      overallStatus,
      overallSeverity,
      testResults,
      warning: "Results not persisted: " + dbErr.message,
    });
  }
};

module.exports = { runTests };
