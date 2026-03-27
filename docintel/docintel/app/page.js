"use client";
import { useState, useRef, useCallback } from "react";
import styles from "./page.module.css";

const MODEL = "claude-sonnet-4-20250514";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("File read failed"));
    r.readAsDataURL(file);
  });
}

export default function Home() {
  const [files, setFiles] = useState([]);
  const [activeIdx, setActiveIdx] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFiles = useCallback((newFiles) => {
    const pdfs = [...newFiles].filter((f) => f.type === "application/pdf");
    setFiles((prev) => {
      const existing = new Set(prev.map((x) => x.name));
      const additions = pdfs
        .filter((f) => !existing.has(f.name))
        .map((f) => ({ file: f, name: f.name, size: f.size, status: "ready", result: null }));
      return [...prev, ...additions];
    });
  }, []);

  const selectFile = (i) => {
    setActiveIdx(i);
  };

  const runAnalysis = async (idx) => {
    const entry = files[idx];
    setFiles((prev) => prev.map((f, i) => i === idx ? { ...f, status: "processing" } : f));

    try {
      const b64 = await toBase64(entry.file);

      const payload = {
        model: MODEL,
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: b64 },
              },
              {
                type: "text",
                text: `Analyse this document and return ONLY a JSON object (no markdown, no preamble) with this exact structure:
{
  "title": "document title or inferred short title",
  "type": "document type (e.g. Annual Report, Research Paper, Financial Statement)",
  "pages_est": number,
  "word_count_est": number,
  "summary": "2-3 sentence executive summary",
  "insights": [
    { "icon": "emoji", "text": "key insight with any important <strong>highlighted value</strong>" }
  ],
  "stats": [
    { "label": "stat name", "value": "value", "note": "brief context" }
  ],
  "table": {
    "title": "Main data table title",
    "headers": ["col1", "col2", "col3"],
    "rows": [["val", "val", "val"]],
    "priority": ["high|medium|low for each row"]
  },
  "topics": ["topic1", "topic2"]
}`,
              },
            ],
          },
        ],
      };

      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API error ${res.status}`);

      const raw = data.content.map((b) => b.text || "").join("");
      const result = JSON.parse(raw.replace(/```json|```/g, "").trim());

      setFiles((prev) =>
        prev.map((f, i) => i === idx ? { ...f, status: "done", result } : f)
      );
    } catch (err) {
      setFiles((prev) =>
        prev.map((f, i) => i === idx ? { ...f, status: "error", error: err.message } : f)
      );
    }
  };

  const active = activeIdx !== null ? files[activeIdx] : null;

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoDot}>◆</span> DocIntel
        </div>
        <div className={styles.headerMeta}>Document Intelligence Platform</div>
        <div className={styles.headerActions}>
          <span className={`${styles.badge} ${styles.live}`}>Claude AI</span>
          <span className={styles.badge}>{files.length} doc{files.length !== 1 ? "s" : ""}</span>
        </div>
      </header>

      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          {/* Upload */}
          <div
            className={`${styles.uploadZone} ${dragging ? styles.dragging : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className={styles.uploadIcon}>📄</div>
            <div className={styles.uploadLabel}>
              <strong>Drop PDF files here</strong>
              <br />or click to browse
            </div>
          </div>

          {/* File List */}
          <div>
            <div className={styles.sectionTitle}>Loaded Documents</div>
            <div className={styles.fileList}>
              {files.length === 0 && (
                <div className={styles.noFiles}>No documents yet</div>
              )}
              {files.map((f, i) => (
                <div
                  key={f.name}
                  className={`${styles.fileItem} ${activeIdx === i ? styles.active : ""}`}
                  onClick={() => selectFile(i)}
                >
                  <span className={styles.fileIcon}>📄</span>
                  <span className={styles.fileName} title={f.name}>{f.name}</span>
                  <span className={styles.fileSize}>{(f.size / 1024).toFixed(0)}k</span>
                  <span
                    className={`${styles.fileStatus} ${
                      f.status === "done" ? styles.done :
                      f.status === "processing" ? styles.processing :
                      f.status === "error" ? styles.errDot : ""
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "auto" }}>
            <button
              className={styles.btnPrimary}
              disabled={active === null || active.status === "processing"}
              onClick={() => runAnalysis(activeIdx)}
            >
              {active?.status === "processing" ? "Analysing…" :
               active?.status === "done" ? "✦ Re-analyse" : "✦ Analyse Document"}
            </button>
          </div>
        </aside>

        {/* Main Panel */}
        <main className={styles.main}>
          {!active && <EmptyState />}
          {active?.status === "ready" && <ReadyState name={active.name} />}
          {active?.status === "processing" && <ProcessingState />}
          {active?.status === "error" && <ErrorState message={active.error} />}
          {active?.status === "done" && <Results entry={active} />}
        </main>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>◈</div>
      <h2>No document selected</h2>
      <p>Upload a PDF report and click Analyse to extract insights and key data.</p>
    </div>
  );
}

function ReadyState({ name }) {
  return (
    <>
      <div className={styles.docBanner}>
        <span style={{ fontSize: "1.5rem" }}>📄</span>
        <div>
          <div className={styles.docBannerName}>{name}</div>
          <div className={styles.docBannerMeta}>Ready to analyse</div>
        </div>
      </div>
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon} style={{ opacity: 0.2 }}>◈</div>
        <h2>Ready to analyse</h2>
        <p>Click <strong>Analyse Document</strong> to extract insights and data tables from this PDF.</p>
      </div>
    </>
  );
}

function ProcessingState() {
  return (
    <div className={styles.processingState}>
      <div className={styles.spinner} />
      <div className={styles.processingLabel}>Processing document</div>
      <div className={styles.processingStep}>Sending to Claude AI…</div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className={styles.errorBox}>
      <strong>Analysis failed:</strong> {message}
    </div>
  );
}

function Results({ entry }) {
  const r = entry.result;
  const tbl = r.table || {};
  const hasTable = tbl.headers && tbl.rows?.length;

  const copyCSV = () => {
    const rows = [tbl.headers, ...tbl.rows].map((r) => r.join(",")).join("\n");
    navigator.clipboard.writeText(rows).then(() => alert("Copied as CSV!"));
  };

  return (
    <>
      {/* Banner */}
      <div className={styles.docBanner}>
        <span style={{ fontSize: "1.5rem" }}>📄</span>
        <div style={{ flex: 1 }}>
          <div className={styles.docBannerName}>{r.title || entry.name}</div>
          <div className={styles.docBannerMeta}>
            {r.type} · ~{(r.word_count_est || 0).toLocaleString()} words · ~{r.pages_est || "?"} pages
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", justifyContent: "flex-end" }}>
          {(r.topics || []).map((t) => (
            <span key={t} className={styles.topicTag}>{t}</span>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className={styles.card}>
        <div className={styles.sectionTitle} style={{ padding: "1rem 1.25rem 0" }}>Executive Summary</div>
        <div className={styles.cardBody}>
          <p style={{ fontSize: "0.92rem", lineHeight: 1.7 }}>{r.summary}</p>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        {(r.stats || []).map((s) => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statLabel}>{s.label}</div>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statSub}>{s.note}</div>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>◆ Key Insights</div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.insightList}>
            {(r.insights || []).map((ins, i) => (
              <div key={i} className={styles.insightItem}>
                <span className={styles.insightIcon}>{ins.icon || "◆"}</span>
                <div
                  className={styles.insightText}
                  dangerouslySetInnerHTML={{ __html: ins.text }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {hasTable && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>📊 {tbl.title || "Extracted Data"}</div>
            <button className={styles.btnGhost} onClick={copyCSV}>Copy CSV</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr>{tbl.headers.map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {tbl.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci}>
                        {ci === 0 && tbl.priority?.[ri] ? (
                          <span className={`${styles.tag} ${styles[tbl.priority[ri]] || styles.low}`}>{cell}</span>
                        ) : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
