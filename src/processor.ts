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

// ----------------------
// Snippet / message parsing
// ----------------------

/**
 * Strips ANSI escape codes from a string.
 */
function stripAnsi(s: string): string {
    return s.replace(/\u001b\[[0-9;]*[mGKHF]/g, '')
        .replace(/\u001b\][^\u0007]*\u0007/g, '')
        .replace(/[\u0000-\u0008\u000b-\u001a\u001c-\u001f]/g, '');
}

/**
 * Extracts the "expect(received)…" failure description from a Playwright
 * error message.
 */
function extractMutatedLine(message: string): string {
    const stripped = stripAnsi(message);
    for (const line of stripped.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('Error: expect(')) {
            return trimmed.replace(/^Error:\s*/, '').trim();
        }
        if (trimmed.startsWith('expect(')) {
            return trimmed;
        }
    }
    return '';
}

// ----------------------
// findTests
// ----------------------

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

            const softErrors: any[] = safeArray(latestResult.errors).filter(
                (e: any) => e && typeof e === 'object'
            );
            const isSoftTest = softErrors.length > 0;

            const mutations: string[] = [];

            if (isSoftTest) {
                softErrors.forEach((e: any) => {
                    const line = extractMutatedLine(safeString(e.message));
                    if (line) mutations.push(line);
                });
            } else {
                const error = latestResult.error;
                if (error && typeof error === 'object') {
                    const line = extractMutatedLine(safeString(error.message));
                    if (line) mutations.push(line);
                }
            }

            // Format mutations for HTML
            const formattedMutated = mutations
                .map(m => `<code>${escapeHtml(m.split('//')[0].replace(/;| failed/g, '').trim())}</code>`)
                .join('');

            const info = {
                title: safeString(spec.title),
                file: safeString(spec.file),
                line: safeNumber(spec.line),
                project: safeString(test.projectName || 'default'),
                mutatedAssertion: formattedMutated,
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
// HTML generation
// ----------------------

// ----------------------
// HTML generation
// ----------------------

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Apophasis Mutation Report</title>
    <style>
        :root {
            --bg: #0f172a;
            --card-bg: #1e293b;
            --table-bg: #334155;
            --border: #475569;
            --text: #f8fafc;
            --muted: #94a3b8;
            --accent: #38bdf8;
            --success: #065f46;
            --danger: #7f1d1d;
        }

        body {
            font-family: -apple-system, system-ui, sans-serif;
            margin: 0;
            padding: 20px;
            background: var(--bg);
            color: var(--text);
            line-height: 1.5;
        }

        .container {
            max-width: 1200px;
            margin: auto;
            background: var(--card-bg);
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        h1 { font-size: 1.8rem; margin-bottom: 1rem; }

        .summary {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin: 20px 0;
        }

        .card {
            padding: 20px;
            border-radius: 12px;
            flex: 1;
            min-width: 200px;
            text-align: center;
        }

        .killed  { background: var(--success); }
        .survived { background: var(--danger); }

        .table-wrapper {
            width: 100%;
            overflow-x: auto;
            margin-top: 20px;
            border-radius: 8px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--table-bg);
            font-size: 0.9rem;
        }

        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
        }

        /* Sorting Styles */
        th { 
            background: var(--border); 
            position: sticky; 
            top: 0; 
            cursor: pointer; 
            user-select: none;
            transition: background 0.2s;
        }
        
        th:hover { background: #4b5563; }

        th::after {
            content: ' ↕';
            font-size: 0.8em;
            color: var(--muted);
            float: right;
        }

        th.sort-asc::after { content: ' ▲'; color: var(--accent); }
        th.sort-desc::after { content: ' ▼'; color: var(--accent); }

        .file-path { color: var(--muted); font-family: monospace; font-size: 0.8em; word-break: break-all; }

        /* Authentic Playwright Reporter Accents */
        .project-tag {
            display: inline-block;
            padding: 2px 12px;
            border-radius: 9999px; /* Pill shape */
            border: 1.5px solid var(--accent);
            background-color: var(--bg);
            color: var(--accent);
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            font-weight: 500;
            font-size: 14px;
        }

        .project-tag.chromium {
            --accent: #5397e5; 
            --bg: #0d1a2c;
        }

        .project-tag.firefox {
            --accent: #bd9039;
            --bg: #1e160a;
        }

        .project-tag.webkit {
            --accent: #9d7bd8;
            --bg: #1b122c;
        }

        code {
            font-family: monospace;
            background: rgba(0,0,0,0.2);
            padding: 2px 4px;
            border-radius: 4px;
            word-break: break-word;
            display: block;
            margin-top: 3px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Apophasis Mutation Results</h1>

        <div class="summary">
            <div class="card killed">
                <div style="font-size: 2em; font-weight: bold;">${killed.length}</div>
                <div>Mutants Killed</div>
            </div>
            <div class="card survived">
                <div style="font-size: 2em; font-weight: bold;">${survived.length}</div>
                <div>Survivors Found</div>
            </div>
        </div>

        <h2>${survived.length > 0 ? '⚠️ Survivors Detected' : '✅ All Mutants Killed'}</h2>

        <div class="table-wrapper">
            <table id="survivorsTable">
                <thead>
                    <tr>
                        <th onclick="sortTable('survivorsTable', 0)">Project</th>
                        <th onclick="sortTable('survivorsTable', 1)">Test Title</th>
                        <th onclick="sortTable('survivorsTable', 2)">File Location</th>
                    </tr>
                </thead>
                <tbody>
                    ${survived.map(s => `
                        <tr>
                            <td><span class="project-tag ${escapeHtml(s.project)}">${escapeHtml(s.project)}</span></td>
                            <td><strong>${escapeHtml(s.title)}</strong></td>
                            <td class="file-path">${escapeHtml(s.file)}:${s.line}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <h2 style="margin-top: 40px;">💀 Killed Mutants Details</h2>

        <div class="table-wrapper">
            <table id="killedTable">
                <thead>
                    <tr>
                        <th onclick="sortTable('killedTable', 0)">Project</th>
                        <th onclick="sortTable('killedTable', 1)">Test Name</th>
                        <th onclick="sortTable('killedTable', 2)">Mutated Assertion(s)</th>
                        <th onclick="sortTable('killedTable', 3)">File Path</th>
                    </tr>
                </thead>
                <tbody>
                    ${killed.map((k) => `
                        <tr>
                            <td><span class="project-tag ${escapeHtml(k.project)}">${escapeHtml(k.project)}</span></td>
                            <td>${escapeHtml(k.title)}</td>
                            <td>${k.mutatedAssertion}</td>
                            <td class="file-path">${escapeHtml(k.file)}:${k.line}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <script>
        function sortTable(tableId, colIndex) {
            const table = document.getElementById(tableId);
            const tbody = table.tBodies[0];
            const rows = Array.from(tbody.rows);
            const header = table.querySelectorAll('th')[colIndex];
            const isAscending = header.classList.contains('sort-asc');
            
            // Reset headers
            table.querySelectorAll('th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
            
            // Sort logic
            const sortedRows = rows.sort((a, b) => {
                const aColText = a.cells[colIndex].textContent.trim().toLowerCase();
                const bColText = b.cells[colIndex].textContent.trim().toLowerCase();
                
                return isAscending 
                    ? bColText.localeCompare(aColText, undefined, {numeric: true})
                    : aColText.localeCompare(bColText, undefined, {numeric: true});
            });

            // Update UI
            header.classList.add(isAscending ? 'sort-desc' : 'sort-asc');
            while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
            tbody.append(...sortedRows);
        }
    </script>
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

    if (minutes > 0 && seconds === 0) return `${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

const total = killed.length + survived.length;
const score = total > 0 ? ((killed.length / total) * 100).toFixed(1) : '0.0';

console.log(`\n⏳ Report generation time: ${reportDurationMs.toFixed(2)} ms (${formatDuration(reportDurationMs)})`);
console.log('\nℹ️ Note: Playwright test failures are expected — they indicate killed mutants, and where they were killed.');
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