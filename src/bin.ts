#!/usr/bin/env node
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const rawArgs = process.argv.slice(2);
const isCI = !!process.env.CI || !!process.env.CONTINUOUS_INTEGRATION;

// ----------------------
// Safe File Opener
// ----------------------
function openFile(filePath: string) {
    if (isCI) {
        console.log(`\n[CI] Skipping UI open for: ${filePath}`);
        return;
    }

    const platform = os.platform();

    try {
        if (platform === 'darwin') {
            spawnSync('open', [filePath], { stdio: 'ignore' });
        } else if (platform === 'win32') {
            spawnSync('cmd', ['/c', 'start', '""', filePath], { stdio: 'ignore' });
        } else {
            spawnSync('xdg-open', [filePath], { stdio: 'ignore' });
        }
    } catch (err) {
        console.error(`\nCould not open file: ${(err as Error).message}`);
    }
}

// ----------------------
// Report Mode (no args parsing needed)
// ----------------------
if (rawArgs.includes('report')) {
    const reportHtml = path.resolve(process.cwd(), 'apophasis-report', 'apophasis-report.html');

    if (fs.existsSync(reportHtml)) {
        console.log('\nOpening report...');
        openFile(reportHtml);
    } else {
        console.error('\n❌ Report HTML not found at:', reportHtml);
    }

    process.exit(0);
}

// ----------------------
// Paths
// ----------------------
const basePath = path.resolve(process.cwd(), 'apophasis-report');
const reportPath = path.join(basePath, 'apophasis-results.json');

if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
}

// ----------------------
// STRICT ARGUMENT PARSER (ALLOWLIST)
// ----------------------
type ParsedArgs = {
    grep?: string;
    headed?: boolean;
    workers?: number;
    timeout?: number;
    retries?: number;
    project?: string;
    baseline?: boolean;
    baselineOnly?: boolean;
};

function parseArgs(args: string[]): ParsedArgs {
    const parsed: ParsedArgs = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case 'grep':
            case '--grep': {
                const value = args[i + 1];
                if (!value || value.startsWith('--')) {
                    throw new Error('Invalid value for --grep');
                }
                parsed.grep = value;
                i++;
                break;
            }

            case '--headed':
                parsed.headed = true;
                break;

            case '--workers': {
                const value = Number(args[i + 1]);
                if (!Number.isInteger(value) || value <= 0) {
                    throw new Error('Invalid value for --workers');
                }
                parsed.workers = value;
                i++;
                break;
            }

            case '--timeout': {
                const value = Number(args[i + 1]);
                if (!Number.isInteger(value) || value < 0) {
                    throw new Error('Invalid value for --timeout');
                }
                parsed.timeout = value;
                i++;
                break;
            }

            case '--retries': {
                const value = Number(args[i + 1]);
                if (!Number.isInteger(value) || value < 0) {
                    throw new Error('Invalid value for --retries');
                }
                parsed.retries = value;
                i++;
                break;
            }

            case '--project': {
                const value = args[i + 1];
                if (!value || value.startsWith('--')) {
                    throw new Error('Invalid value for --project');
                }
                parsed.project = value;
                i++;
                break;
            }

            case '--baseline':
                parsed.baseline = true;
                break;

            case '--baseline-only':
                parsed.baselineOnly = true;
                parsed.baseline = true; // implies baseline
                break;

            default:
                throw new Error(`Unsupported argument: ${arg}`);
        }
    }

    return parsed;
}

// ----------------------
// Playwright Args Builder
// ----------------------
function buildPlaywrightArgs(parsedArgs: ParsedArgs, useHook: boolean): string[] {
    const args: string[] = [];

    if (useHook) {
        args.push('-r', hookPath);
    }

    args.push(
        playwrightBin,
        'test',
        '--reporter=json',
    );

    if (parsedArgs.grep) {
        args.push('--grep', parsedArgs.grep);
    }

    if (parsedArgs.headed) {
        args.push('--headed');
    }

    if (parsedArgs.workers !== undefined) {
        args.push('--workers', String(parsedArgs.workers));
    }

    if (parsedArgs.timeout !== undefined) {
        args.push('--timeout', String(parsedArgs.timeout));
    }

    if (parsedArgs.retries !== undefined) {
        args.push('--retries', String(parsedArgs.retries));
    }

    if (parsedArgs.project) {
        args.push('--project', parsedArgs.project);
    }

    return args;
}

let parsedArgs: ParsedArgs;


try {
    parsedArgs = parseArgs(rawArgs);
} catch (err) {
    console.error(`❌ Argument error: ${(err as Error).message}`);
    process.exit(1);
}

// ----------------------
// Build Safe Playwright Args
// ----------------------
const hookPath = path.resolve(__dirname, 'hook.js');
const playwrightBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'playwright');

const playwrightArgs = buildPlaywrightArgs(parsedArgs, true);

// Apply parsed args safely
if (parsedArgs.grep) {
    playwrightArgs.push('--grep', parsedArgs.grep);
}

if (parsedArgs.headed) {
    playwrightArgs.push('--headed');
}

if (parsedArgs.workers !== undefined) {
    playwrightArgs.push('--workers', String(parsedArgs.workers));
}

if (parsedArgs.timeout !== undefined) {
    playwrightArgs.push('--timeout', String(parsedArgs.timeout));
}

if (parsedArgs.retries !== undefined) {
    playwrightArgs.push('--retries', String(parsedArgs.retries));
}

if (parsedArgs.project) {
    playwrightArgs.push('--project', parsedArgs.project);
}

// ----------------------
// Baseline Execution (no mutation)
// ----------------------
if (parsedArgs.baseline) {
    console.log('\n🧪 Running baseline Playwright (no mutation)...');

    const baselineResult = spawnSync('node', buildPlaywrightArgs(parsedArgs, false), {
        env: {
            ...process.env,
            APOPHASIS_MUTATE: 'false',
        },
        stdio: 'pipe',
        encoding: 'utf-8',
        shell: false,
    });

    if (!baselineResult.stdout) {
        console.error('\n❌ No output from baseline run');
        process.exit(1);
    }

    let baselineJson;

    try {
        baselineJson = JSON.parse(baselineResult.stdout);
    } catch (e) {
        console.error('\n❌ Failed to parse baseline JSON output');
        console.error(baselineResult.stdout);
        process.exit(1);
    }

    // ----------------------
    // Baseline Summary
    // ----------------------
    const stats = baselineJson.stats;

    const passed = stats.expected;
    const failed = stats.unexpected;
    const skipped = stats.skipped;
    const total = passed + failed + skipped;

    console.log('\n🧪 Baseline Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total:    ${total}`);
    console.log(`Passed:   ${passed}`);
    console.log(`Failed:   ${failed}`);
    console.log(`Skipped:  ${skipped}`);
    console.log(`Duration: ${(stats.duration / 1000).toFixed(2)}s`);

    // ----------------------
    // Collect Failures
    // ----------------------
    function collectFailures(suites: any[], acc: string[] = []): string[] {
        for (const suite of suites) {
            if (suite.specs) {
                for (const spec of suite.specs) {
                    for (const test of spec.tests || []) {
                        for (const result of test.results || []) {
                            if (result.status === 'failed') {
                                acc.push(spec.title);
                            }
                        }
                    }
                }
            }
            if (suite.suites) {
                collectFailures(suite.suites, acc);
            }
        }
        return acc;
    }

    if (failed > 0) {
        const failures = collectFailures(baselineJson.suites);

        console.log('\n❌ Failing Tests:');
        for (const f of failures) {
            console.log(`  - ${f}`);
        }
        process.exit(1); // Stop right here
    }

    if (parsedArgs.baselineOnly) {
        console.log('\n✅ Baseline completed. Exiting (baseline-only mode).');
        process.exit(0);
    }
}

// ----------------------
// Mutation Execution
// ----------------------
console.log('\n🚀 Running Apophasis Mutation Testing...');
if (!parsedArgs.baseline)
    console.warn('\n⚠️ Running without baseline validation. Results may be unreliable.');
const testStart = process.hrtime.bigint();
const result = spawnSync('node', playwrightArgs, {
    env: {
        ...process.env,
        APOPHASIS_MUTATE: 'true',
        PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
    },
    stdio: 'pipe', // change to inherit for debugging
    shell: false, // 🔒 critical
});

// ----------------------
// Exit Handling
// ----------------------
if (result.error) {
    console.error('\n❌ Failed to launch Playwright:', result.error.message);
    process.exit(1);
}

if (typeof result.status === 'number') {
    if (result.status !== 0) {
        console.warn(`\nPlaywright failed successfully!`);
        console.log('\n\nGenerating report...')
    }
}

const testEnd = process.hrtime.bigint();
const testDurationMs = Number(testEnd - testStart) / 1_000_000;

const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`;
    }

    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

console.log(
    `\n⏱️  Mutated test execution time: ${testDurationMs.toFixed(2)} ms (${formatDuration(testDurationMs)})`
);

// ----------------------
// Post-processing
// ----------------------
const defaultJsonPath = path.resolve(process.cwd(), 'test-results.json');

if (!fs.existsSync(reportPath) && fs.existsSync(defaultJsonPath)) {
    fs.renameSync(defaultJsonPath, reportPath);
}

if (!fs.existsSync(reportPath)) {
    console.error(`\n❌ Mutation results not found at ${reportPath}`);
    process.exit(1);
}

// 🔒 Safe require (local file only)
const processorPath = path.resolve(__dirname, 'processor.js');

if (!fs.existsSync(processorPath)) {
    console.error('\n❌ Processor file not found');
    process.exit(1);
}

try {
    require(processorPath);
} catch (e) {
    console.error('\n❌ Mutation Processor failed:', e);
    process.exit(1);
}