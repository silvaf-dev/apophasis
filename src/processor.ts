import fs from 'fs';
import path from 'path';

const basePath = path.resolve(process.cwd(), 'apophasis-report');

const reportFile = 'apophasis-results.json';
const outputFile = 'apophasis-report.html';

const reportPath = path.join(basePath, reportFile);
const outputPath = path.join(basePath, outputFile);

if (!fs.existsSync(reportPath)) {
    console.error(`Error: ${reportPath} not found. Run Playwright with --reporter=json first.`);
    process.exit(1);
}

let data: any;
try {
    data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
} catch (e) {
    console.error("Error: Failed to parse Apophasis JSON. Check if the test run crashed.");
    process.exit(1);
}

const killed: any[] = [];
const survived: any[] = [];

function findTests(suite: any) {
    if (suite.specs) {
        suite.specs.forEach((spec: any) => {
            spec.tests.forEach((test: any) => {
                const latestResult = test.results[test.results.length - 1];
                
                if (!latestResult) return;

                const actualStatus = latestResult.status;
                const info = {
                    title: spec.title,
                    file: spec.file,
                    line: spec.line,
                    project: test.projectName || 'default' // This contains the browser/project name
                };

                if (actualStatus === 'passed') {
                    survived.push(info);
                } else {
                    killed.push(info);
                }
            });
        });
    }
    if (suite.suites) {
        suite.suites.forEach(findTests);
    }
}

data.suites.forEach(findTests);

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Apophasis Mutation Report</title>
    <style>
        body { font-family: -apple-system, system-ui, sans-serif; margin: 40px; background: #0f172a; color: #f8fafc; }
        .container { max-width: 1000px; margin: auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); }
        .summary { display: flex; gap: 20px; margin: 30px 0; }
        .card { padding: 25px; border-radius: 12px; flex: 1; text-align: center; }
        .killed { background: #065f46; border: 1px solid #10b981; }
        .survived { background: #7f1d1d; border: 1px solid #ef4444; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; background: #334155; border-radius: 8px; overflow: hidden; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #475569; }
        th { background: #475569; color: #f1f5f9; }
        .file-path { color: #94a3b8; font-family: monospace; font-size: 0.85em; }
        .project-tag { background: #1e293b; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; color: #38bdf8; border: 1px solid #38bdf8; }
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
                        <td><span class="project-tag">${s.project}</span></td>
                        <td><strong>${s.title}</strong></td>
                        <td class="file-path">${s.file}:${s.line}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>
`;

fs.writeFileSync(outputPath, htmlContent);
console.log(`\n✅ Apophasis report generated. Open with npx apophasis report`);
console.log(`💀 Killed: ${killed.length} | 🛡️ Survived: ${survived.length}`);