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
        console.log(`[CI] Skipping UI open for: ${filePath}`);
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
        console.error(`Could not open file: ${(err as Error).message}`);
    }
}

// ----------------------
// Report Mode (no args parsing needed)
// ----------------------
if (rawArgs.includes('report')) {
    const reportHtml = path.resolve(process.cwd(), 'apophasis-report', 'apophasis-report.html');

    if (fs.existsSync(reportHtml)) {
        console.log('Opening report...');
        openFile(reportHtml);
    } else {
        console.error('❌ Report HTML not found at:', reportHtml);
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

            default:
                throw new Error(`Unsupported argument: ${arg}`);
        }
    }

    return parsed;
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

const playwrightArgs: string[] = [
    '-r',
    hookPath,
    playwrightBin,
    'test',

    // 🔒 FORCE SAFE FLAGS (cannot be overridden)
    '--reporter=json',
];

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
// Execution
// ----------------------
console.log('🚀 Starting Apophasis Mutation Testing...');

const result = spawnSync('node', playwrightArgs, {
    env: {
        ...process.env,
        APOPHASIS_MUTATE: 'true',
        PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
    },
    stdio: 'inherit',
    shell: false, // 🔒 critical
});

// ----------------------
// Exit Handling
// ----------------------
if (result.error) {
    console.error('❌ Failed to launch Playwright:', result.error.message);
    process.exit(1);
}

if (typeof result.status === 'number') {
    if (result.status !== 0) {
        console.warn(`⚠️ Playwright exited with code ${result.status}`);
    }
}

// ----------------------
// Post-processing
// ----------------------
const defaultJsonPath = path.resolve(process.cwd(), 'test-results.json');

if (!fs.existsSync(reportPath) && fs.existsSync(defaultJsonPath)) {
    fs.renameSync(defaultJsonPath, reportPath);
}

if (!fs.existsSync(reportPath)) {
    console.error(`❌ Mutation results not found at ${reportPath}`);
    process.exit(1);
}

// 🔒 Safe require (local file only)
const processorPath = path.resolve(__dirname, 'processor.js');

if (!fs.existsSync(processorPath)) {
    console.error('❌ Processor file not found');
    process.exit(1);
}

try {
    require(processorPath);
} catch (e) {
    console.error('❌ Mutation Processor failed:', e);
    process.exit(1);
}