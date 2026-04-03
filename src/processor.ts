#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const basePath = path.resolve(process.cwd(), 'apophasis-report');

const reportFile = 'apophasis-results.json';
const outputFile = 'apophasis-report.html';

const reportPath = path.join(basePath, reportFile);
const outputPath = path.join(basePath, outputFile);

// ----------------------
// Security limits
// ----------------------

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ----------------------
// Helpers
// ----------------------

function fail(msg: string): never {
    console.error(`Error: ${msg}`);
    process.exit(1);
}

function escapeHtml(input: unknown): string {
    if (typeof input !== 'string') return '';
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeArray(value: any): any[] {
    return Array.isArray(value) ? value : [];
}

function safeString(value: any): string {
    return typeof value === 'string' ? value : '';
}

function safeNumber(value: any): number {
    return typeof value === 'number' ? value : 0;
}

// ----------------------
// File checks
// ----------------------

if (!fs.existsSync(reportPath)) {
    fail(`${reportPath} not found. Run Playwright with --reporter=json first.`);
}

const stat = fs.statSync(reportPath);

if (!stat.isFile()) {
    fail(`Report path is not a file`);
}

if (stat.size > MAX_FILE_SIZE) {
    fail(`Report file too large (> ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
}

// ----------------------
// Parse JSON safely
// ----------------------

let data: any;

try {
    const raw = fs.readFileSync(reportPath, 'utf8');
    data = JSON.parse(raw);
} catch {
    fail("Failed to parse Apophasis JSON. The file may be corrupted.");
}

if (!data || typeof data !== 'object') {
    fail("Invalid JSON structure");
}

// ----------------------
// Processing
// ----------------------

const reportStart = process.hrtime.bigint();

const killed: any[] = [];
const survived: any[] = [];

function findTests(suite: any): void {
    if (!suite || typeof suite !== 'object') return;

    const specs = safeArray(suite.specs);

    for (const spec of specs) {
        if (!spec || typeof spec !== 'object') continue;

        const tests = safeArray(spec.tests);

        for (const test of tests) {
            if (!test || typeof test !== 'object') continue;

            const results = safeArray(test.results);
            const latestResult = results[results.length - 1];

            if (!latestResult || typeof latestResult !== 'object') continue;

            const status = safeString(latestResult.status);

            const info = {
                title: safeString(spec.title),
                file: safeString(spec.file),
                line: safeNumber(spec.line),
                project: safeString(test.projectName || 'default')
            };

            if (status === 'passed') {
                survived.push(info);
            } else if (status) {
                killed.push(info);
            }
        }
    }

    const suites = safeArray(suite.suites);
    for (const child of suites) {
        findTests(child);
    }
}

const rootSuites = safeArray(data.suites);
for (const suite of rootSuites) {
    findTests(suite);
}

// ----------------------
// HTML generation (escaped)
// ----------------------

const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Apophasis Mutation Report</title>
    <style>
        body { font-family: -apple-system, system-ui, sans-serif; margin: 40px; background: #0f172a; color: #f8fafc; }
        .container { max-width: 1000px; margin: auto; background: #1e293b; padding: 30px; border-radius: 12px; }
        .summary { display: flex; gap: 20px; margin: 30px 0; }
        .card { padding: 25px; border-radius: 12px; flex: 1; text-align: center; }
        .killed { background: #065f46; }
        .survived { background: #7f1d1d; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; background: #334155; }
        th, td { padding: 12px; border-bottom: 1px solid #475569; }
        th { background: #475569; }
        .file-path { color: #94a3b8; font-family: monospace; font-size: 0.85em; }
        .project-tag { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; color: #38bdf8; border: 1px solid #38bdf8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Apophasis Mutation Results</h1>

        <div class="summary">
            <div class="card killed">
                <div style="font-size: 2.5em; font-weight: bold;">${killed.length}</div>
                <div>Mutants Killed</div>
            </div>
            <div class="card survived">
                <div style="font-size: 2.5em; font-weight: bold;">${survived.length}</div>
                <div>Survivors Found</div>
            </div>
        </div>

        <h2>${survived.length > 0 ? '⚠️ Survivors Detected' : '✅ All Mutants Killed'}</h2>

        <table>
            <thead>
                <tr>
                    <th>Browser/Project</th>
                    <th>Test Title</th>
                    <th>File Location</th>
                </tr>
            </thead>
            <tbody>
                ${survived.map(s => `
                    <tr>
                        <td><span class="project-tag">${escapeHtml(s.project)}</span></td>
                        <td><strong>${escapeHtml(s.title)}</strong></td>
                        <td class="file-path">${escapeHtml(s.file)}:${s.line}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;

// ----------------------
// Safe write
// ----------------------

try {
    fs.mkdirSync(basePath, { recursive: true });
    fs.writeFileSync(outputPath, htmlContent, { flag: 'w' });
} catch {
    fail("Failed to write HTML report");
}

// ----------------------
// Output
// ----------------------

const reportEnd = process.hrtime.bigint();
const reportDurationMs = Number(reportEnd - reportStart) / 1_000_000;

function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0 && seconds === 0) {
        return `${minutes}m`;
    }

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
}

const total = killed.length + survived.length;
const score = total > 0 ? ((killed.length / total) * 100).toFixed(1) : '0.0';

console.log(`\n⏳ Report generation time: ${reportDurationMs.toFixed(2)} ms (${formatDuration(reportDurationMs)})`)

console.log('\nℹ️ Note: Playwright test failures are expected — they indicate killed mutants, and where they were killed.')

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Apophasis report generated
📋 Open HTML version with: npx apophasis report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Results

💀 Killed Mutants
   ${killed.length}

🛡️ Survived Mutants
   ${survived.length}

🎯 Mutation Score
   ${score}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);