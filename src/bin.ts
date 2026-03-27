#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);

if (args.includes('report')) {
    // Logic to just open the HTML file
    console.log("Opening report...");
    execSync('open apophasis-report/apophasis-report.html');
    process.exit(0);
}

console.log('🚀 Starting Apophasis Mutation Testing...');

const basePath = path.resolve(process.cwd(), 'apophasis-report');
const reportFile = 'apophasis-results.json';
const reportPath = path.join(basePath, reportFile);

// 1. Ensure the directory exists BEFORE running the tests
if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
}

try {
    const hookPath = require.resolve('./hook.js');

    // 2. We use PLAYWRIGHT_JSON_OUTPUT_NAME to force the path.
    // We also move the execution into a controlled environment.
    execSync(`node -r "${hookPath}" ./node_modules/.bin/playwright test --reporter=json`, {
        env: {
            ...process.env,
            APOPHASIS_MUTATE: 'true',
            PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath // Directs Playwright to write here
        },
        stdio: 'inherit'
    });

} catch (e) {
    // 3. We EXPECT an error here because mutants should cause test failures.
    // We don't exit; we just acknowledge Playwright finished.
    console.log('\n⚠️  Playwright finished (Mutations caused expected failures).');
}

// 4. Check for the file OUTSIDE of the try/catch block
// Some versions of Playwright might still use the default name if the env var is ignored
const defaultJsonPath = path.resolve(process.cwd(), 'test-results.json');
if (!fs.existsSync(reportPath) && fs.existsSync(defaultJsonPath)) {
    fs.renameSync(defaultJsonPath, reportPath);
}

// Small delay to ensure the OS flush is complete
setTimeout(() => {
    if (fs.existsSync(reportPath)) {
        require('./processor');
    } else {
        console.error(`\n❌ Error: ${reportPath} was not created.`);
        console.error('Check if your playwright.config.ts has "reporter" settings that conflict with CLI flags.');
        process.exit(1);
    }
}, 500);