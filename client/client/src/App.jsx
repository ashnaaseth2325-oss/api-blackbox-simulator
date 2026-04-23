import "./App.css";
import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000";
const METHODS = ["GET", "POST", "PUT", "DELETE"];
const PRESET_TESTS = [
  "Empty Body",
  "Null Values",
  "Wrong Data Types",
  "Large Payload",
  "Invalid Endpoint",
];

const RULES_PLACEHOLDER = `{
  "expectedStatus": 200,
  "maxResponseTime": 500,
  "mustContain": ["id", "name"],
  "mustNotContain": ["error"]
}`;

// ── Small reusable components ────────────────────────────────────────────────

function StatusBadge({ status }) {
  return (
    <span className={`badge ${status === "Passed" ? "badge-pass" : "badge-fail"}`}>
      {status === "Passed" ? "✓" : "✗"} {status}
    </span>
  );
}

function SeverityBadge({ severity }) {
  if (!severity) return null;
  return (
    <span className={`severity-badge sev-${severity}`}>{severity}</span>
  );
}

function ErrorTypePill({ type }) {
  if (!type) return null;
  const cls = { timeout: "pill-timeout", network: "pill-network", server_error: "pill-server", invalid_url: "pill-invalid", unknown: "pill-unknown" };
  return <span className={`error-type-pill ${cls[type] || "pill-unknown"}`}>{type}</span>;
}

function RuleResult({ ruleResult }) {
  if (!ruleResult) return null;
  if (ruleResult.passed)
    return <div className="rule-pass">All {ruleResult.rulesChecked} rule{ruleResult.rulesChecked !== 1 ? "s" : ""} passed</div>;
  return (
    <div className="rule-failures">
      <p className="failures-label">Rule failures ({ruleResult.failures.length} / {ruleResult.rulesChecked})</p>
      <ul className="failures-list">
        {ruleResult.failures.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
    </div>
  );
}

function InsightsList({ insightDetails }) {
  if (!insightDetails?.length) return null;
  return (
    <div className="insights-in-card">
      <p className="insights-card-label">Insights</p>
      {insightDetails.map((ins, i) => (
        <div key={i} className={`insight-item insight-${ins.severity}`}>
          <span className={`insight-dot dot-${ins.severity}`} />
          <span className="insight-text">{ins.message}</span>
        </div>
      ))}
    </div>
  );
}

function DebugPanel({ debug, errorType }) {
  if (!debug) return null;
  const headers = debug.responseHeaders || {};
  const headerCount = Object.keys(headers).length;
  return (
    <div className="debug-panel">
      {errorType && (
        <div className="debug-section">
          <span className="debug-label">Error Type</span>
          <ErrorTypePill type={errorType} />
        </div>
      )}
      <div className="debug-section">
        <span className="debug-label">Payload Sent</span>
        <pre className="debug-code">
          {debug.payloadSent !== null && debug.payloadSent !== undefined
            ? JSON.stringify(debug.payloadSent, null, 2)
            : "none"}
        </pre>
      </div>
      <div className="debug-section">
        <span className="debug-label">Response Body Preview</span>
        <pre className="debug-code">{debug.dataPreview || "empty"}</pre>
      </div>
      {headerCount > 0 && (
        <div className="debug-section">
          <span className="debug-label">Response Headers ({headerCount})</span>
          <div className="headers-grid">
            {Object.entries(headers).map(([k, v]) => (
              <div key={k} className="header-row">
                <span className="header-key">{k}</span>
                <span className="header-val">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [requestBody, setRequestBody] = useState("");
  const [customHeaders, setCustomHeaders] = useState("");
  const [testRules, setTestRules] = useState("");
  const [bodyError, setBodyError] = useState("");
  const [rulesError, setRulesError] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [enabledTests, setEnabledTests] = useState(new Set(PRESET_TESTS));
  const [expandedDebug, setExpandedDebug] = useState(new Set());

  const [activeTab, setActiveTab] = useState("tester");
  const abortRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("All");
  const [analytics, setAnalytics] = useState(null);
  const [insightsData, setInsightsData] = useState(null);

  useEffect(() => {
    fetchHistory("All");
    fetchAnalytics();
    fetchInsights();
  }, []);

  // ── Fetchers ─────────────────────────────────────────────────────────────

  const fetchHistory = async (filter) => {
    try {
      const params = filter && filter !== "All" ? { status: filter } : {};
      const res = await axios.get(`${API_BASE}/history`, { params });
      setHistory(res.data.data || []);
    } catch { /* silent */ }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API_BASE}/analytics`);
      setAnalytics(res.data.data);
    } catch { /* silent */ }
  };

  const fetchInsights = async () => {
    try {
      const res = await axios.get(`${API_BASE}/insights`);
      setInsightsData(res.data.data);
    } catch { /* silent */ }
  };

  // ── Validators ────────────────────────────────────────────────────────────

  const validateJson = (val, setError) => {
    if (!val.trim()) { setError(""); return true; }
    try { JSON.parse(val); setError(""); return true; }
    catch { setError("Invalid JSON"); return false; }
  };

  // ── Tester handlers ───────────────────────────────────────────────────────

  const togglePreset = (name) => {
    setEnabledTests((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleDebug = (index) => {
    setExpandedDebug((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const handleRunTests = async () => {
    if (!url.trim()) return alert("Please enter a URL");
    if (!validateJson(requestBody, setBodyError)) return;
    if (!validateJson(testRules, setRulesError)) return;

    let parsedHeaders = {};
    if (customHeaders.trim()) {
      try { parsedHeaders = JSON.parse(customHeaders); }
      catch { return alert("Invalid JSON in Custom Headers"); }
    }

    let parsedRules = null;
    if (testRules.trim()) {
      try { parsedRules = JSON.parse(testRules); }
      catch { return; }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setResults([]);
    setExpandedDebug(new Set());

    try {
      const res = await axios.post(
        `${API_BASE}/test-api`,
        {
          url: url.trim(), method,
          requestBody: requestBody.trim() ? JSON.parse(requestBody) : null,
          headers: parsedHeaders,
          enabledTests: [...enabledTests],
          rules: parsedRules,
        },
        { signal: controller.signal }
      );
      setResults(res.data.testResults || []);
      fetchHistory(historyFilter);
      fetchAnalytics();
      fetchInsights();
    } catch (err) {
      if (err.code === "ERR_CANCELED" || err.name === "CanceledError") {
        setResults([{ testName: "Cancelled", status: "Failed", errorMessage: "Request cancelled by user", insights: [], insightDetails: [] }]);
      } else {
        alert(`Backend error: ${err.response?.data?.message || err.message}`);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => { if (abortRef.current) abortRef.current.abort(); };

  // ── History handlers ──────────────────────────────────────────────────────

  const handleDeleteHistory = async (id) => {
    try {
      await axios.delete(`${API_BASE}/history/${id}`);
      setHistory((prev) => prev.filter((h) => h._id !== id));
      fetchAnalytics();
      fetchInsights();
    } catch { alert("Failed to delete record"); }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Clear all history? This cannot be undone.")) return;
    try {
      await axios.delete(`${API_BASE}/history`);
      setHistory([]);
      fetchAnalytics();
      fetchInsights();
    } catch { alert("Failed to clear history"); }
  };

  const handleFilterChange = (filter) => {
    setHistoryFilter(filter);
    fetchHistory(filter);
  };

  const handleExport = (format) => window.open(`${API_BASE}/history/export?format=${format}`, "_blank");

  const truncateUrl = (u, max = 50) => u.length > max ? u.slice(0, max) + "…" : u;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="main">
        <h1 className="title">API Blackbox Simulator</h1>
        <p className="subtitle">
          Stress-test APIs. Validate responses. Catch edge cases before production.
        </p>

        {/* ── Tabs ── */}
        <div className="tab-nav">
          {[
            { key: "tester",    label: "Tester"    },
            { key: "history",   label: "History"   },
            { key: "analytics", label: "Analytics" },
            { key: "insights",  label: "Insights"  },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`tab-btn ${activeTab === key ? "tab-active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════
            TESTER TAB
        ════════════════════════════════════════ */}
        {activeTab === "tester" && (
          <div className="tester-section">
            <div className="input-group">
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={`method-select method-${method.toLowerCase()}`}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
              <input
                placeholder="https://api.example.com/endpoint"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleRunTests()}
              />
            </div>

            <div className="field-section">
              <label className="field-label">Request Body <span className="label-hint">(JSON)</span></label>
              <textarea
                className={`field-textarea ${bodyError ? "field-error" : ""}`}
                placeholder={'{\n  "key": "value"\n}'}
                value={requestBody}
                onChange={(e) => { setRequestBody(e.target.value); validateJson(e.target.value, setBodyError); }}
                rows={3}
              />
              {bodyError && <span className="error-text">{bodyError}</span>}
            </div>

            <div className="field-section">
              <label className="field-label">Custom Headers <span className="label-hint">(JSON)</span></label>
              <textarea className="field-textarea" placeholder={'{\n  "Authorization": "Bearer <token>"\n}'} value={customHeaders} onChange={(e) => setCustomHeaders(e.target.value)} rows={2} />
            </div>

            <div className="field-section">
              <label className="field-label">Test Rules <span className="label-hint">(JSON — applied to Custom Request)</span></label>
              <textarea
                className={`field-textarea ${rulesError ? "field-error" : ""}`}
                placeholder={RULES_PLACEHOLDER}
                value={testRules}
                onChange={(e) => { setTestRules(e.target.value); validateJson(e.target.value, setRulesError); }}
                rows={5}
              />
              {rulesError && <span className="error-text">{rulesError}</span>}
              <div className="rules-hint-row">
                <span className="label-hint">Supported: expectedStatus · maxResponseTime · mustContain[] · mustNotContain[] · requiredHeaders[] · minResponseSize · maxResponseSize</span>
              </div>
            </div>

            <div className="field-section">
              <label className="field-label">Preset Tests <span className="label-hint">(click to toggle)</span></label>
              <div className="preset-grid">
                {PRESET_TESTS.map((name) => (
                  <button key={name} className={`preset-chip ${enabledTests.has(name) ? "chip-on" : "chip-off"}`} onClick={() => togglePreset(name)}>
                    <span className="chip-dot" /> {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="action-row">
              <button className="run-btn" onClick={handleRunTests} disabled={loading}>
                {loading ? <><span className="spinner" /> Running tests...</> : "Run Tests"}
              </button>
              {loading && <button className="cancel-btn" onClick={handleCancel}>Cancel</button>}
            </div>

            {/* ── Results ── */}
            {results.length > 0 && (
              <div className="results-section">
                <hr className="divider" />
                <p className="field-label">Results</p>
                {results.map((r, i) => (
                  <div key={i} className={`card ${r.status === "Passed" ? "success" : "fail"}`} style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="card-header">
                      <span className="card-title">{r.testName}</span>
                      <div className="card-header-right">
                        <SeverityBadge severity={r.severity} />
                        <StatusBadge status={r.status} />
                        <button className="debug-toggle" onClick={() => toggleDebug(i)}>
                          {expandedDebug.has(i) ? "Hide Debug" : "Debug"}
                        </button>
                      </div>
                    </div>

                    <div className="card-meta">
                      {r.statusCode != null && <span className="meta-pill">HTTP {r.statusCode}</span>}
                      {r.responseTime != null && <span className="meta-pill">{r.responseTime} ms</span>}
                      {r.responseSize != null && r.responseSize > 0 && <span className="meta-pill">{r.responseSize} B</span>}
                      {r.errorType && <ErrorTypePill type={r.errorType} />}
                    </div>

                    {r.errorMessage && <p className="error-text" style={{ marginTop: "8px" }}>{r.errorMessage}</p>}

                    <RuleResult ruleResult={r.ruleResult} />
                    <InsightsList insightDetails={r.insightDetails} />

                    {expandedDebug.has(i) && <DebugPanel debug={r.debug} errorType={r.errorType} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            HISTORY TAB
        ════════════════════════════════════════ */}
        {activeTab === "history" && (
          <div className="history-section">
            <div className="history-toolbar">
              <div className="filter-group">
                {["All", "Passed", "Failed"].map((f) => (
                  <button key={f} className={`filter-btn ${historyFilter === f ? "filter-active" : ""}`} onClick={() => handleFilterChange(f)}>{f}</button>
                ))}
              </div>
              <div className="action-group">
                <button className="export-btn" onClick={() => handleExport("json")}>Export JSON</button>
                <button className="export-btn" onClick={() => handleExport("csv")}>Export CSV</button>
                <button className="danger-btn" onClick={handleClearHistory}>Clear All</button>
              </div>
            </div>

            {history.length === 0 ? (
              <p className="empty-state">No history yet — run your first test!</p>
            ) : (
              history.map((h) => (
                <div key={h._id} className={`history-row ${h.status === "Passed" ? "success" : "fail"}`}>
                  <div className="hrow-left">
                    <span className={`method-badge mbadge-${h.method.toLowerCase()}`}>{h.method}</span>
                    <span className="hrow-url" title={h.url}>{h.url}</span>
                  </div>
                  <div className="hrow-right">
                    <StatusBadge status={h.status} />
                    {h.severity && <SeverityBadge severity={h.severity} />}
                    {h.statusCode && <span className="meta-pill">HTTP {h.statusCode}</span>}
                    {h.responseTime && <span className="meta-pill">{h.responseTime} ms</span>}
                    {h.rulesUsed && <span className="meta-pill rules-pill">rules</span>}
                    <span className="meta-pill dim">{new Date(h.createdAt).toLocaleString()}</span>
                    <button className="delete-btn" onClick={() => handleDeleteHistory(h._id)} title="Delete">✕</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            ANALYTICS TAB
        ════════════════════════════════════════ */}
        {activeTab === "analytics" && (
          <div className="analytics-section">
            {!analytics || analytics.totalTests === 0 ? (
              <p className="empty-state">No data yet — run some tests first!</p>
            ) : (
              <>
                <div className="analytics-grid">
                  <div className="stat-card"><span className="stat-value">{analytics.totalTests}</span><span className="stat-label">Total Tests</span></div>
                  <div className="stat-card stat-pass"><span className="stat-value">{analytics.passedTests}</span><span className="stat-label">Passed</span></div>
                  <div className="stat-card stat-fail"><span className="stat-value">{analytics.failedTests}</span><span className="stat-label">Failed</span></div>
                  <div className="stat-card stat-rate"><span className="stat-value">{analytics.successRate}%</span><span className="stat-label">Success Rate</span></div>
                  <div className="stat-card"><span className="stat-value">{analytics.avgResponseTime} ms</span><span className="stat-label">Avg Response</span></div>
                  <div className="stat-card"><span className="stat-value">{analytics.minResponseTime} ms</span><span className="stat-label">Fastest</span></div>
                  <div className="stat-card"><span className="stat-value">{analytics.maxResponseTime} ms</span><span className="stat-label">Slowest</span></div>
                </div>

                <div className="progress-row">
                  <span className="progress-label">Pass rate — {analytics.successRate}%</span>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${analytics.successRate}%` }} /></div>
                </div>

                {analytics.perEndpoint?.length > 0 && (
                  <div className="endpoint-section">
                    <p className="section-heading">Per-Endpoint Breakdown</p>
                    <div className="endpoint-table-wrap">
                      <table className="endpoint-table">
                        <thead><tr><th>Endpoint</th><th>Total</th><th>Passed</th><th>Failed</th><th>Success %</th><th>Avg (ms)</th></tr></thead>
                        <tbody>
                          {analytics.perEndpoint.map((ep, i) => (
                            <tr key={i}>
                              <td className="ep-url" title={ep.endpoint}>{truncateUrl(ep.endpoint, 45)}</td>
                              <td>{ep.total}</td>
                              <td className="cell-pass">{ep.passed}</td>
                              <td className="cell-fail">{ep.failed}</td>
                              <td><span className={ep.successRate >= 80 ? "cell-pass" : ep.successRate >= 50 ? "cell-warn" : "cell-fail"}>{ep.successRate}%</span></td>
                              <td>{ep.avgTime}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {analytics.trend?.length > 0 && (
                  <div className="trend-section">
                    <p className="section-heading">Response Time Trend <span className="label-hint">(last {analytics.trend.length} tests)</span></p>
                    <TrendChart trend={analytics.trend} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            INSIGHTS TAB
        ════════════════════════════════════════ */}
        {activeTab === "insights" && (
          <div className="insights-tab">
            {!insightsData ? (
              <p className="empty-state">Loading insights...</p>
            ) : insightsData.commonIssues?.length === 0 && insightsData.unstableEndpoints?.length === 0 ? (
              <p className="empty-state">No insight data yet — run some tests first!</p>
            ) : (
              <>
                {/* Severity breakdown */}
                {insightsData.severityBreakdown?.length > 0 && (
                  <div className="insights-block">
                    <p className="section-heading">Severity Distribution</p>
                    <div className="severity-grid">
                      {["high", "medium", "low"].map((sev) => {
                        const entry = insightsData.severityBreakdown.find((s) => s.severity === sev);
                        return (
                          <div key={sev} className={`sev-stat-card sev-stat-${sev}`}>
                            <span className="sev-stat-value">{entry?.count ?? 0}</span>
                            <span className="sev-stat-label">{sev.charAt(0).toUpperCase() + sev.slice(1)} Severity</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Common issues */}
                {insightsData.commonIssues?.length > 0 && (
                  <div className="insights-block">
                    <p className="section-heading">Most Frequent Issues</p>
                    <div className="common-issues-list">
                      {insightsData.commonIssues.map((item, i) => (
                        <div key={i} className="common-issue-row">
                          <span className="issue-rank">#{i + 1}</span>
                          <span className="issue-message">{item.issue}</span>
                          <span className="issue-count">{item.count}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unstable endpoints */}
                {insightsData.unstableEndpoints?.length > 0 && (
                  <div className="insights-block">
                    <p className="section-heading">Unstable Endpoints</p>
                    <div className="endpoint-table-wrap">
                      <table className="endpoint-table">
                        <thead><tr><th>Endpoint</th><th>Runs</th><th>Failures</th><th>Failure Rate</th><th>Avg (ms)</th></tr></thead>
                        <tbody>
                          {insightsData.unstableEndpoints.map((ep, i) => (
                            <tr key={i}>
                              <td className="ep-url" title={ep.endpoint}>{truncateUrl(ep.endpoint, 45)}</td>
                              <td>{ep.total}</td>
                              <td className="cell-fail">{ep.failed}</td>
                              <td><span className={ep.failureRate >= 50 ? "cell-fail" : "cell-warn"}>{ep.failureRate}%</span></td>
                              <td>{ep.avgResponseTime}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Slowest endpoints */}
                {insightsData.slowestEndpoints?.length > 0 && (
                  <div className="insights-block">
                    <p className="section-heading">Slowest Endpoints</p>
                    <div className="endpoint-table-wrap">
                      <table className="endpoint-table">
                        <thead><tr><th>Endpoint</th><th>Runs</th><th>Avg (ms)</th><th>Max (ms)</th></tr></thead>
                        <tbody>
                          {insightsData.slowestEndpoints.map((ep, i) => (
                            <tr key={i}>
                              <td className="ep-url" title={ep.endpoint}>{truncateUrl(ep.endpoint, 45)}</td>
                              <td>{ep.total}</td>
                              <td className={ep.avgResponseTime > 1000 ? "cell-fail" : ep.avgResponseTime > 500 ? "cell-warn" : ""}>{ep.avgResponseTime}</td>
                              <td className={ep.maxResponseTime > 1000 ? "cell-fail" : ""}>{ep.maxResponseTime}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <footer className="footer">
          <div>
            <p className="footer-title">API Blackbox Simulator</p>
            <p className="footer-sub">Test smarter. Ship stronger.</p>
          </div>
          <div>
            <p>Made by <b>Ashnaa Seth</b></p>
            <p className="footer-sub">Breaking APIs. Finding edge cases. Building better systems.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ── Trend chart ───────────────────────────────────────────────────────────────

function TrendChart({ trend }) {
  const maxTime = Math.max(...trend.map((t) => t.responseTime || 0), 1);
  return (
    <div className="trend-chart">
      {trend.map((t, i) => {
        const heightPct = Math.max(((t.responseTime || 0) / maxTime) * 100, 4);
        return (
          <div key={i} className="trend-col">
            <span className="trend-time">{t.responseTime ?? "—"}</span>
            <div className="trend-bar-wrap">
              <div
                className={`trend-bar ${t.status === "Passed" ? "tbar-pass" : "tbar-fail"}`}
                style={{ height: `${heightPct}%` }}
                title={`${t.method} ${t.url}\n${t.responseTime}ms · ${t.status}`}
              />
            </div>
            <span className="trend-label">{t.method}</span>
          </div>
        );
      })}
    </div>
  );
}

export default App;
