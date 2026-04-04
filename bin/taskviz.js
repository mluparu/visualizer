#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const args = process.argv.slice(2)
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
taskviz — Visualize workflow execution as a directed graph

Usage:
  taskviz <logfile.jsonl> [-o output.html] [--no-open]

Options:
  -o <file>    Output HTML file path (default: <logfile>.html)
  --no-open    Don't open the report in a browser
  -h, --help   Show this help message
`)
  process.exit(0)
}

// Parse arguments
let inputFile = ''
let outputFile = ''
let noOpen = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' && args[i + 1]) {
    outputFile = args[++i]
  } else if (args[i] === '--no-open') {
    noOpen = true
  } else if (!args[i].startsWith('-')) {
    inputFile = args[i]
  }
}

if (!inputFile) {
  console.error('Error: no input file specified')
  process.exit(1)
}

const inputPath = resolve(inputFile)
if (!existsSync(inputPath)) {
  console.error(`Error: file not found: ${inputPath}`)
  process.exit(1)
}

// Read and validate the log
const logText = readFileSync(inputPath, 'utf-8')
const lines = logText.split('\n').filter(l => l.trim().length > 0)
if (lines.length === 0) {
  console.error('Error: log file is empty')
  process.exit(1)
}

// Validate JSON
for (let i = 0; i < lines.length; i++) {
  try {
    const obj = JSON.parse(lines[i])
    if (!obj.taskId || !obj.name || !obj.status) {
      console.error(`Error: line ${i + 1} missing required fields (taskId, name, status)`)
      process.exit(1)
    }
  } catch {
    console.error(`Error: line ${i + 1} is not valid JSON`)
    process.exit(1)
  }
}

// Find the built HTML template
const distHtml = resolve(__dirname, '..', 'dist', 'index.html')
if (!existsSync(distHtml)) {
  console.error('Error: dist/index.html not found. Run "npm run build" first.')
  process.exit(1)
}

let template = readFileSync(distHtml, 'utf-8')

// Inject data — safely encode the log text as a JSON string
const safeData = JSON.stringify(logText)
const injection = `<script>window.__TASKVIZ_DATA__=${safeData}<\/script>`
template = template.replace('</head>', `${injection}\n</head>`)

// Write output
if (!outputFile) {
  outputFile = basename(inputFile).replace(/\.[^.]+$/, '') + '.html'
}
const outputPath = resolve(outputFile)
const outputDir = dirname(outputPath)
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
writeFileSync(outputPath, template, 'utf-8')
console.log(`✓ Report written to ${outputPath}`)

// Open in browser
if (!noOpen) {
  const platform = process.platform
  try {
    if (platform === 'win32') {
      execSync(`start "" "${outputPath}"`, { stdio: 'ignore' })
    } else if (platform === 'darwin') {
      execSync(`open "${outputPath}"`, { stdio: 'ignore' })
    } else {
      execSync(`xdg-open "${outputPath}"`, { stdio: 'ignore' })
    }
  } catch {
    // Silently fail if browser can't be opened
  }
}
