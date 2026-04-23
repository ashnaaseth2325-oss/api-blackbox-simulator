/**
 * Insights Engine
 *
 * Takes a raw request result, optional rule validation outcome, and test
 * context, then returns a structured explanation of what happened and why.
 *
 * Returns:
 *   insights       [String]  — human-readable messages, ordered high→low severity
 *   insightDetails [Object]  — { message, category, severity } per insight
 *   severity       String|null — "high" | "medium" | "low" | null (clean run)
 */

const SLOW_MS    = 500;
const SEVERE_MS  = 1000;
const LARGE_BYTES = 50_000; // 50 KB

// ── Builders ─────────────────────────────────────────────────────────────────

const ins = (message, category, severity) => ({ message, category, severity });

// ── Error-type insights ───────────────────────────────────────────────────────

const ERROR_INSIGHTS = {
  timeout: ins(
    "Request timed out — the server is unresponsive, overloaded, or blocked by a firewall",
    "connectivity", "high"
  ),
  network: ins(
    "Network failure — the domain could not be resolved or the connection was actively refused",
    "connectivity", "high"
  ),
  invalid_url: ins(
    "Malformed URL — verify the protocol (http/https), hostname, and path are well-formed",
    "configuration", "high"
  ),
  server_error: ins(
    "Server threw an exception before returning a response — check server logs for stack traces",
    "server", "high"
  ),
  unknown: ins(
    "Unexpected transport error — the request could not be completed for an unknown reason",
    "unknown", "high"
  ),
};

const fromErrorType = (errorType, errorMessage) => {
  if (!errorType) return [];
  const base = ERROR_INSIGHTS[errorType];
  if (!base) return [];
  // Append the raw error detail to make it actionable
  return [{ ...base, message: `${base.message}${errorMessage ? ` (${errorMessage})` : ""}` }];
};

// ── HTTP status-code insights ─────────────────────────────────────────────────

const fromStatusCode = (code) => {
  if (!code) return [];

  if (code >= 500)
    return [ins(
      `Server-side failure (HTTP ${code}) — the API crashed or threw an unhandled exception; inspect server logs`,
      "server", "high"
    )];
  if (code === 429)
    return [ins(
      "Rate limit exceeded (HTTP 429) — you are sending requests too frequently; implement backoff or throttling",
      "rate_limit", "medium"
    )];
  if (code === 408)
    return [ins(
      "Server-side timeout (HTTP 408) — the server closed the connection; the operation may be too slow",
      "connectivity", "high"
    )];
  if (code === 401)
    return [ins(
      "Unauthorized (HTTP 401) — valid credentials are required; check Authorization headers or tokens",
      "auth", "medium"
    )];
  if (code === 403)
    return [ins(
      "Forbidden (HTTP 403) — authenticated but the resource is access-restricted for this user/role",
      "auth", "medium"
    )];
  if (code === 404)
    return [ins(
      "Endpoint not found (HTTP 404) — the URL path does not exist on the target server",
      "routing", "medium"
    )];
  if (code === 422)
    return [ins(
      "Unprocessable entity (HTTP 422) — the server understood the request but rejected it due to semantic errors",
      "validation", "medium"
    )];
  if (code >= 400)
    return [ins(
      `Client-side error (HTTP ${code}) — check request headers, body format, content-type, and URL parameters`,
      "client", "medium"
    )];

  return [];
};

// ── Performance insights ──────────────────────────────────────────────────────

const fromPerformance = (responseTime) => {
  if (responseTime == null) return [];
  if (responseTime > SEVERE_MS)
    return [ins(
      `Severe latency (${responseTime}ms) — possible causes: slow DB query, no caching, N+1 query, or external API call in the hot path`,
      "performance", "high"
    )];
  if (responseTime > SLOW_MS)
    return [ins(
      `Slow response (${responseTime}ms) — exceeds the 500ms production threshold; consider caching, indexing, or async processing`,
      "performance", "medium"
    )];
  return [];
};

// ── Response body insights ────────────────────────────────────────────────────

const fromResponseBody = (result) => {
  if (!result.success) return [];
  const out = [];
  const data = result.data;
  const bodyStr = JSON.stringify(data ?? "");

  const isEmpty =
    data === null ||
    data === undefined ||
    data === "" ||
    bodyStr === '""' ||
    bodyStr === "{}" ||
    bodyStr === "[]";

  if (isEmpty)
    out.push(ins(
      "Empty response body — the API returned no data; verify the endpoint is meant to return content for this method",
      "response", "medium"
    ));

  if ((result.responseSize ?? 0) > LARGE_BYTES)
    out.push(ins(
      `Large response payload (${Math.round(result.responseSize / 1024)}KB) — add pagination, field selection, or response compression`,
      "performance", "low"
    ));

  return out;
};

// ── Rule-failure insights ─────────────────────────────────────────────────────

const fromRuleFailures = (ruleResult) => {
  if (!ruleResult || ruleResult.passed) return [];
  const out = [];

  for (const failure of ruleResult.failures) {
    if (failure.includes("missing required value")) {
      const match = failure.match(/"([^"]+)"/);
      const term = match?.[1] ?? "unknown";
      out.push(ins(
        `Incomplete data — response is missing the expected field/value "${term}"; the API contract may be broken`,
        "data_integrity", "medium"
      ));
    } else if (failure.includes("forbidden value")) {
      const match = failure.match(/"([^"]+)"/);
      const term = match?.[1] ?? "unknown";
      out.push(ins(
        `Forbidden content "${term}" detected in response — this may indicate an error message leaking into a success response`,
        "data_integrity", "high"
      ));
    } else if (failure.includes("Missing required response header")) {
      const match = failure.match(/"([^"]+)"/);
      const header = match?.[1] ?? "unknown";
      out.push(ins(
        `Response header "${header}" is absent — this may break CORS, caching, or security policy enforcement`,
        "headers", "low"
      ));
    } else if (/exceeded limit of \d+ms/.test(failure)) {
      out.push(ins(
        "Response time violated the defined SLA — this endpoint is not meeting latency requirements under current conditions",
        "sla", "medium"
      ));
    } else if (failure.includes("Expected status")) {
      out.push(ins(
        "Status code mismatch — the API is not conforming to the expected contract; check for regression or environment mismatch",
        "contract", "medium"
      ));
    } else if (failure.includes("size")) {
      out.push(ins(
        "Response size outside acceptable bounds — verify pagination or trimming is configured correctly",
        "response", "low"
      ));
    }
  }

  return out;
};

// ── Preset-test context insights ──────────────────────────────────────────────

const fromPresetContext = (testName, result) => {
  if (!testName || testName === "Custom Request") return [];
  const code = result.statusCode;
  const out = [];

  if (testName === "Empty Body") {
    if (!result.success || code >= 500)
      out.push(ins(
        "Empty body caused a server crash — add null/empty input guards before processing or database writes",
        "robustness", "high"
      ));
    else if (code >= 400)
      out.push(ins(
        "API correctly rejected the empty body — input validation is functioning as expected",
        "robustness", "low"
      ));
  }

  if (testName === "Null Values") {
    if (!result.success || code >= 500)
      out.push(ins(
        "Null values caused a server crash — this is a critical bug; the API must handle null inputs without throwing",
        "null_safety", "high"
      ));
    else if (code >= 400)
      out.push(ins(
        "API gracefully rejected null values — null-safety validation is working correctly",
        "null_safety", "low"
      ));
  }

  if (testName === "Wrong Data Types") {
    if (!result.success || code >= 500)
      out.push(ins(
        "Wrong data types crashed the server — add type coercion or schema validation (e.g., Joi, Zod) before processing",
        "type_safety", "high"
      ));
    else if (code >= 400)
      out.push(ins(
        "API correctly rejected wrong data types — type validation is enforced at the boundary",
        "type_safety", "low"
      ));
  }

  if (testName === "Large Payload") {
    if (code === 413)
      out.push(ins(
        "Server correctly enforced a payload size limit (HTTP 413) — body-size limiting is configured",
        "payload", "low"
      ));
    else if (!result.success || code >= 500)
      out.push(ins(
        "Large payload caused a server crash — set an explicit body size limit (e.g., express: `express.json({ limit: '1mb' })`)",
        "payload", "high"
      ));
    else if (code >= 400 && code !== 413)
      out.push(ins(
        "Large payload was rejected with a client error — verify the content-length limit and request configuration",
        "payload", "medium"
      ));
  }

  if (testName === "Invalid Endpoint") {
    if (code === 404)
      out.push(ins(
        "Invalid endpoint correctly returned 404 — the router has proper catch-all error handling",
        "routing", "low"
      ));
    else if (!result.success || code >= 500)
      out.push(ins(
        "Invalid endpoint caused a server crash — add a global 404 handler to prevent exception leakage on unknown routes",
        "routing", "high"
      ));
    else if (code !== 404)
      out.push(ins(
        `Invalid endpoint returned HTTP ${code} instead of 404 — the router may be falling through to an unintended handler`,
        "routing", "medium"
      ));
  }

  return out;
};

// ── Severity aggregation ──────────────────────────────────────────────────────

const computeSeverity = (details) => {
  if (!details.length) return null;
  if (details.some((i) => i.severity === "high"))   return "high";
  if (details.some((i) => i.severity === "medium")) return "medium";
  return "low";
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @param {object} result      — from requestService.executeRequest
 * @param {object} ruleResult  — from rulesEngine.validate (may be null)
 * @param {string} testName    — e.g. "Custom Request", "Empty Body"
 * @param {object} rules       — original rules object (for context)
 */
const analyze = ({ result, ruleResult = null, testName = "Custom Request", rules = null }) => {
  const raw = [
    ...fromErrorType(result.errorType, result.error),
    ...fromStatusCode(result.statusCode),
    ...fromPerformance(result.responseTime),
    ...fromResponseBody(result),
    ...fromRuleFailures(ruleResult),
    ...fromPresetContext(testName, result),
  ];

  // Deduplicate by message (in case multiple paths produce the same insight)
  const seen = new Set();
  const insightDetails = raw.filter((i) => {
    if (seen.has(i.message)) return false;
    seen.add(i.message);
    return true;
  });

  // Sort: high → medium → low so the most critical appears first
  const ORDER = { high: 0, medium: 1, low: 2 };
  insightDetails.sort((a, b) => (ORDER[a.severity] ?? 3) - (ORDER[b.severity] ?? 3));

  return {
    insights: insightDetails.map((i) => i.message),
    insightDetails,
    severity: computeSeverity(insightDetails),
  };
};

module.exports = { analyze };
