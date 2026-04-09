#!/usr/bin/env bun
/**
 * nanoagent - minimal agentic coding assistant
 * ReAct pattern with token-accurate context management and episodic memory
 */

// ─── IMPORTS ─────────────────────────────────────────────────────────────────
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { execSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import * as readline from "node:readline";
import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";
import { pipeline } from '@xenova/transformers';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8192;
const SHELL_TIMEOUT = 30000;
const TRACE_FILE = `${homedir()}/.nanoagent/trace.jsonl`;
const CONTEXT_WINDOW = 200000;
const RECALL_THRESHOLD = 0.3;

const USE_SANDBOX = process.env.DISABLE_SANDBOX !== "true";
const SANDBOX_MEMORY = "512m";
const SANDBOX_CPUS = "1.0";
const SANDBOX_PIDS = 100;

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
};

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Message = {
  role: "user" | "assistant";
  content: string | any[];
};

type Tool = {
  desc: string;
  params: string[];
  fn: (args: any) => Promise<string> | string;
};

type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
};

type TraceTurn = {
  timestamp: string;
  messages: Message[];
  embedding: number[];
};

// ─── UTILITIES ──────────────────────────────────────────────────────────────
const tokenizer = new Tiktoken(cl100k_base);

function countTokens(text: string): number {
  return tokenizer.encode(text).length;
}

function messageTokens(msg: Message): number {
  return countTokens(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content));
}

function totalMessageTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + messageTokens(msg), 0);
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// ─── SANDBOX ─────────────────────────────────────────────────────────────────
class Sandbox {
  containerId: string | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) return;

    const name = `nanoagent-sandbox-${randomBytes(8).toString("hex")}`;
    const cwd = process.cwd();

    try {
      execSync("docker image inspect nanoagent-sandbox", { stdio: "ignore" });
    } catch {
      console.log(`${ANSI.cyan}Building sandbox image...${ANSI.reset}`);
      execSync("docker build -f Dockerfile.sandbox -t nanoagent-sandbox .", { cwd, stdio: "inherit" });
    }

    const args = [
      "docker", "run", "-d", "--rm", "--name", name,
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--network", "none",
      "--read-only",
      "--tmpfs", "/tmp:rw,noexec,nosuid,size=100m",
      "-v", `${cwd}:/workspace`,
      "--user", `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
      "-w", "/workspace",
      "--memory", SANDBOX_MEMORY,
      "--memory-swap", SANDBOX_MEMORY,
      "--cpus", SANDBOX_CPUS,
      "--pids-limit", SANDBOX_PIDS.toString(),
      "nanoagent-sandbox",
    ];

    const result = spawnSync(args[0], args.slice(1), { encoding: "utf-8", timeout: 10000 });
    if (result.status !== 0) throw new Error(`Failed to start sandbox: ${result.stderr || result.error?.message}`);

    this.containerId = result.stdout.trim();
    if (!/^[a-f0-9]{12,64}$/.test(this.containerId)) throw new Error(`Invalid container ID: ${this.containerId}`);
    this.isRunning = true;
  }

  async exec(command: string, timeout = SHELL_TIMEOUT): Promise<ExecResult> {
    if (!this.isRunning || !this.containerId) throw new Error("Sandbox not running");

    return new Promise((resolve) => {
      let stdout = "", stderr = "", timedOut = false;
      const proc = spawn("docker", ["exec", this.containerId!, "bash", "-c", command]);
      const timer = setTimeout(() => { timedOut = true; proc.kill("SIGKILL"); }, timeout);

      proc.stdout.on("data", (d) => (stdout += d.toString()));
      proc.stderr.on("data", (d) => (stderr += d.toString()));

      proc.on("close", (code) => {
        clearTimeout(timer);
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? -1, timedOut });
      });
      proc.on("error", (err) => {
        clearTimeout(timer);
        resolve({ stdout: stdout.trim(), stderr: err.message, exitCode: -1, timedOut });
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.containerId) return;
    try { execSync(`docker stop ${this.containerId}`, { stdio: "ignore", timeout: 5000 }); }
    catch { try { execSync(`docker rm -f ${this.containerId}`, { stdio: "ignore" }); } catch {} }
    this.isRunning = false;
    this.containerId = null;
  }
}

let globalSandbox: Sandbox | null = null;

async function getSandbox(): Promise<Sandbox | null> {
  if (!USE_SANDBOX) return null;

  if (!globalSandbox) {
    globalSandbox = new Sandbox();
    await globalSandbox.start();

    process.on("exit", () => {
      if (globalSandbox?.containerId) {
        try { execSync(`docker stop ${globalSandbox.containerId}`, { stdio: "ignore", timeout: 5000 }); } catch {}
      }
    });
    process.on("SIGINT", () => process.exit(0));
    process.on("SIGTERM", () => process.exit(0));
  }

  return globalSandbox;
}

// ─── TOOLS ───────────────────────────────────────────────────────────────────
const TOOLS: Record<string, Tool> = {
  read: {
    desc: "Read file with line numbers. Use offset/limit to paginate large files (0-indexed line numbers)",
    params: ["path", "offset?", "limit?"],
    fn: async (args) => {
      const lines = (await readFile(args.path, "utf-8")).split("\n");
      const start = args.offset ?? 0;
      const end = start + (args.limit ?? lines.length);
      return lines.slice(start, end).map((line, i) =>
        `${String(start + i + 1).padStart(4)}| ${line}`
      ).join("\n");
    },
  },
  write: {
    desc: "Write content to file",
    params: ["path", "content"],
    fn: async (args) => {
      await writeFile(args.path, args.content, "utf-8");
      return "ok";
    },
  },
  edit: {
    desc: "Replace old with new in file. Use all=true to replace all occurrences",
    params: ["path", "old", "new", "all?"],
    fn: async (args) => {
      const content = await readFile(args.path, "utf-8");
      if (!content.includes(args.old)) return "error: old_string not found";
      const escaped = args.old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const count = (content.match(new RegExp(escaped, "g")) ?? []).length;
      if (!args.all && count > 1) return `error: old_string appears ${count} times. Use all=true to replace all`;
      const result = args.all ? content.replaceAll(args.old, args.new) : content.replace(args.old, args.new);
      await writeFile(args.path, result, "utf-8");
      return "ok";
    },
  },
  glob: {
    desc: "Find files by pattern. Defaults to current directory if path not specified",
    params: ["pat", "path?"],
    fn: async (args) => {
      const files: string[] = [];
      for await (const file of new Bun.Glob(`${args.path ?? "."}/${args.pat}`).scan()) {
        files.push(file);
      }
      return files.join("\n") || "none";
    },
  },
  grep: {
    desc: "Search files for regex. Defaults to current directory if path not specified",
    params: ["pat", "path?"],
    fn: async (args) => {
      const pattern = new RegExp(args.pat);
      const hits: string[] = [];
      for await (const file of new Bun.Glob(`${args.path ?? "."}/**`).scan()) {
        if (file.includes("node_modules")) continue;
        try {
          const content = await readFile(file, "utf-8");
          content.split("\n").forEach((line, i) => {
            if (pattern.test(line)) hits.push(`${file}:${i + 1}:${line.trim()}`);
          });
        } catch {}
      }
      return hits.slice(0, 50).join("\n") || "none";
    },
  },
  bash: {
    desc: "Run shell command (sandboxed)",
    params: ["cmd"],
    fn: async (args) => {
      let sandbox = await getSandbox();

      if (!sandbox) {
        try {
          return execSync(args.cmd, { encoding: "utf-8", timeout: SHELL_TIMEOUT }).trim() || "(empty)";
        } catch (err: any) {
          return (err.stdout || err.stderr || String(err)).trim();
        }
      }

      let result = await sandbox.exec(args.cmd);

      if (result.exitCode === -1 && !result.timedOut) {
        await globalSandbox?.stop();
        globalSandbox = null;
        sandbox = (await getSandbox())!;
        result = await sandbox.exec(args.cmd);
      }

      if (result.timedOut) return `error: command timed out after ${SHELL_TIMEOUT}ms`;
      if (result.exitCode !== 0) return result.stderr || result.stdout || `error: exit code ${result.exitCode}`;
      return result.stdout || "(empty)";
    },
  },
};

// ─── TOOL SCHEMA ─────────────────────────────────────────────────────────────
function buildToolSchema() {
  return Object.entries(TOOLS).map(([name, { desc, params }]) => {
    const required = params.filter((p) => !p.endsWith("?")).map((p) => p.replace("?", ""));
    const allParams = params.map((p) => p.replace("?", ""));
    const properties = Object.fromEntries(allParams.map((p) => {
      if (p === "all") return [p, { type: "boolean" }];
      if (p === "offset" || p === "limit") return [p, { type: "integer" }];
      return [p, { type: "string" }];
    }));
    return { name, description: desc, input_schema: { type: "object", properties, required } };
  });
}

const TOOL_SCHEMAS = buildToolSchema();
const TOOL_SCHEMA_TOKENS = countTokens(JSON.stringify(TOOL_SCHEMAS));

// ─── EMBEDDINGS ──────────────────────────────────────────────────────────────
let embedder: any = null;

async function initializeEmbedder(): Promise<void> {
  if (!embedder) {
    console.log(`${ANSI.dim}Loading embedding model...${ANSI.reset}`);
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
}

async function embed(text: string): Promise<number[]> {
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── EPISODIC TRACE ──────────────────────────────────────────────────────────

async function loadEpisodicTrace(): Promise<TraceTurn[]> {
  try {
    const content = await readFile(TRACE_FILE, "utf-8");
    return content.trim().split("\n").map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function turnTokens(turn: TraceTurn): number {
  return turn.messages.reduce((sum, msg) => sum + messageTokens(msg), 0);
}

function turnTextForEmbedding(messages: Message[]): string {
  return messages.map((msg) => {
    if (typeof msg.content === "string") return msg.content;
    return (msg.content as any[]).map((b) => {
      if (b.type === "text") return b.text;
      if (b.type === "tool_use") return `[${b.name}: ${JSON.stringify(b.input).slice(0, 100)}]`;
      if (b.type === "tool_result") return typeof b.content === "string" ? b.content.slice(0, 200) : "";
      return "";
    }).filter(Boolean).join("\n");
  }).join("\n");
}

async function saveEpisode(messages: Message[]): Promise<void> {
  await mkdir(`${homedir()}/.nanoagent`, { recursive: true });
  const embedding = await embed(turnTextForEmbedding(messages));
  const turn: TraceTurn = { timestamp: getCurrentTimestamp(), messages, embedding };
  await appendFile(TRACE_FILE, JSON.stringify(turn) + "\n");
}

// ─── LLM INTERFACE ──────────────────────────────────────────────────────────
async function callLLM(messages: Message[], systemPrompt: string, useTools = true) {
  const body: any = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  };
  if (useTools) body.tools = TOOL_SCHEMAS;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

// ─── RECALL ──────────────────────────────────────────────────────────────────
async function recallMemories(query: string, allTurns: TraceTurn[], recentTurns: TraceTurn[] = []): Promise<string> {
  if (!allTurns.length || !allTurns.some((t) => t.embedding)) return "";

  const queryVec = await embed(query);

  const scored = allTurns
    .filter((t) => t.embedding)
    .map((turn) => ({ turn, score: cosineSimilarity(queryVec, turn.embedding) }))
    .sort((a, b) => b.score - a.score);

  // Skip reranking if nothing is relevant
  if (!scored.length || scored[0].score < RECALL_THRESHOLD) return "";

  const candidates = scored.slice(0, 10).map((c) => c.turn);

  const candidatesText = candidates
    .map((turn, idx) => {
      const date = new Date(turn.timestamp).toLocaleString();
      const summary = turn.messages.map((msg) => {
        const role = msg.role === "user" ? "User" : "Assistant";
        if (typeof msg.content === "string") return `${role}: ${msg.content}`;
        return `${role}: ${(msg.content as any[]).map((b) => {
          if (b.type === "text") return b.text;
          if (b.type === "tool_use") return `[Used tool: ${b.name}]`;
          if (b.type === "tool_result") return `[Tool result: ${typeof b.content === "string" ? b.content.slice(0, 200) : "..."}]`;
          return "";
        }).filter(Boolean).join("\n")}`;
      }).join("\n");
      return `[Turn ${idx}] ${date}\n${summary}`;
    })
    .join("\n\n---\n\n");

  const recentContext = recentTurns.length > 0
    ? recentTurns.map((turn) => {
        const date = new Date(turn.timestamp).toLocaleString();
        const summary = turn.messages.map((msg) => {
          const role = msg.role === "user" ? "User" : "Assistant";
          if (typeof msg.content === "string") return `${role}: ${msg.content}`;
          return `${role}: ${(msg.content as any[]).map((b) => {
            if (b.type === "text") return b.text;
            if (b.type === "tool_use") return `[Used tool: ${b.name}]`;
            if (b.type === "tool_result") return `[Tool result: ${typeof b.content === "string" ? b.content.slice(0, 200) : "..."}]`;
            return "";
          }).filter(Boolean).join("\n")}`;
        }).join("\n");
        return `${date}\n${summary}`;
      }).join("\n\n---\n\n")
    : "";

  const contextSection = recentContext
    ? `Recent conversation context (last 3 turns):

${recentContext}

---

`
    : "";

  const response = await callLLM(
    [{ role: "user", content: `You are extracting relevant memories for a coding assistant.

${contextSection}Current user query: "${query}"

Here are candidate memories from past conversations:

${candidatesText}

Your task:
1. Identify which turns contain information relevant to the current query
2. Extract and summarize the key information from those relevant turns
3. Return a concise memory summary that would help answer the query

Return format:
## What I remember from earlier:

[One paragraph or a few bullet points summarizing the relevant information, with dates when important]

Do NOT return turn indices. Return the actual relevant information extracted and summarized from the turns.` }],
    "You extract and summarize relevant information from past conversations.",
    false,
  );

  return response.content[0].text.trim();
}

// ─── WORKING MEMORY ─────────────────────────────────────────────────────────
async function assembleWorkingMemory(input: string, baseSystemPrompt: string): Promise<{
  systemPrompt: string;
  messages: Message[];
  workingBudget: number;
  bufferEnd: number;
  bufferTurnSizes: number[];
}> {
  const allTurns = await loadEpisodicTrace();

  // Step 1: Get recent turns for context (last 3)
  const recentTurns = allTurns.slice(-3);

  // Step 2: Recall from all turns with recent context
  const recalledMemories = await recallMemories(input, allTurns, recentTurns);

  // Step 3: Assemble full system prompt
  const systemPrompt = recalledMemories
    ? `${baseSystemPrompt}\n\n${recalledMemories}`
    : baseSystemPrompt;

  // Step 4: Compute exact working memory budget
  const systemTokens = countTokens(systemPrompt);
  const workingBudget = CONTEXT_WINDOW - MAX_TOKENS - TOOL_SCHEMA_TOKENS - systemTokens;

  // Step 5: Fill turns buffer (newest first, reserving space for user input)
  const inputTokens = countTokens(input);
  const bufferBudget = workingBudget - inputTokens;

  const bufferTurns: TraceTurn[] = [];
  let bufferTokens = 0;

  for (let i = allTurns.length - 1; i >= 0; i--) {
    const turn = allTurns[i];
    const tokens = turnTokens(turn);
    if (bufferTokens + tokens > bufferBudget) break;
    bufferTurns.unshift(turn);
    bufferTokens += tokens;
  }

  // Step 6: Flatten turns buffer into messages, track turn sizes for eviction
  const messages: Message[] = [];
  const bufferTurnSizes: number[] = [];
  for (const turn of bufferTurns) {
    bufferTurnSizes.push(turn.messages.length);
    messages.push(...turn.messages);
  }

  const bufferEnd = messages.length;
  messages.push({ role: "user", content: input });

  return { systemPrompt, messages, workingBudget, bufferEnd, bufferTurnSizes };
}

function evictOldestTurns(
  messages: Message[],
  workingBudget: number,
  bufferEnd: number,
  bufferTurnSizes: number[],
): number {
  let total = totalMessageTokens(messages);

  while (total > workingBudget && bufferTurnSizes.length > 0) {
    const turnSize = bufferTurnSizes.shift()!;
    for (let i = 0; i < turnSize; i++) {
      total -= messageTokens(messages[0]);
      messages.splice(0, 1);
    }
    bufferEnd -= turnSize;
  }

  return bufferEnd;
}

// ─── TOOL EXECUTION ─────────────────────────────────────────────────────────
async function executeTool(name: string, input: any): Promise<string> {
  try {
    const tool = TOOLS[name];
    if (!tool) return `error: unknown tool ${name}`;
    return await tool.fn(input);
  } catch (err: any) {
    return String(err);
  }
}

// ─── AGENTIC LOOP ────────────────────────────────────────────────────────────
async function agenticLoop(
  messages: Message[],
  systemPrompt: string,
  workingBudget: number,
  bufferEnd: number,
  bufferTurnSizes: number[],
): Promise<void> {
  while (true) {
    // Enforce budget: evict oldest turns from buffer if over
    bufferEnd = evictOldestTurns(messages, workingBudget, bufferEnd, bufferTurnSizes);

    // Reason: ask LLM what to do next
    const response = await callLLM(messages, systemPrompt);

    // Display text output
    for (const block of response.content.filter((b: any) => b.type === "text")) {
      console.log(`\n${ANSI.cyan}⏺${ANSI.reset} ${block.text}`);
    }

    // Act: execute tool calls in parallel
    const toolCalls = response.content.filter((b: any) => b.type === "tool_use");
    const toolResults: any[] = [];

    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        const preview = String(Object.values(call.input)[0] ?? "").slice(0, 50);
        console.log(`\n${ANSI.green}⏺ ${call.name}${ANSI.reset}(${ANSI.dim}${preview}${ANSI.reset})`);
      }

      const results = await Promise.all(
        toolCalls.map((call: any) => executeTool(call.name, call.input))
      );

      for (let i = 0; i < toolCalls.length; i++) {
        const lines = results[i].split("\n");
        const preview = lines[0].slice(0, 60) + (lines.length > 1 ? ` +${lines.length - 1} lines` : "");
        console.log(`  ${ANSI.dim}⎿  ${preview}${ANSI.reset}`);
        toolResults.push({ type: "tool_result", tool_use_id: toolCalls[i].id, content: results[i] });
      }
    }

    // Observe: add response to conversation
    messages.push({ role: "assistant", content: response.content });

    // Done if no tools called
    if (toolResults.length === 0) break;

    // Feed tool results back
    messages.push({ role: "user", content: toolResults });
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${ANSI.red}Error: ANTHROPIC_API_KEY not set${ANSI.reset}`);
    console.error(`${ANSI.dim}Set it in .env file or environment${ANSI.reset}`);
    process.exit(1);
  }

  await initializeEmbedder();

  const baseSystemPrompt = `Concise coding assistant. cwd: ${process.cwd()}

Current time: ${getCurrentTimestamp()}${
    USE_SANDBOX
      ? "\n\nSECURITY: The bash tool runs in a sandboxed Docker container (no network, isolated filesystem, 512MB RAM, 1 CPU). File tools (read, write, edit, glob, grep) run on the host."
      : ""
  }`;

  const oneOffPrompt = process.argv[2];

  // ── One-off mode ──
  if (oneOffPrompt) {
    const ctx = await assembleWorkingMemory(oneOffPrompt, baseSystemPrompt);
    await agenticLoop(ctx.messages, ctx.systemPrompt, ctx.workingBudget, ctx.bufferEnd, ctx.bufferTurnSizes);
    await saveEpisode(ctx.messages.slice(ctx.bufferEnd));
    return;
  }

  // ── REPL mode ──
  console.log(`
${ANSI.bold}${ANSI.cyan}nanoagent${USE_SANDBOX ? " 🐳" : ""}${ANSI.reset}
${ANSI.dim}${MODEL}${ANSI.reset} | ${ANSI.dim}${process.cwd()}${ANSI.reset}${USE_SANDBOX ? ` | ${ANSI.green}sandboxed${ANSI.reset}` : ""}
`);

  const allTurns = await loadEpisodicTrace();
  if (allTurns.length > 0) {
    console.log(`${ANSI.dim}${allTurns.length} episodes in trace${ANSI.reset}`);
  }

  const separator = () => console.log(`${ANSI.dim}${"─".repeat(80)}${ANSI.reset}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    separator();
    const input = await new Promise<string>((resolve) => {
      rl.question(`${ANSI.bold}${ANSI.blue}❯${ANSI.reset} `, (answer) => resolve(answer.trim()));
    });
    separator();

    if (!input) continue;
    if (input === "/q" || input === "exit") break;
    if (input === "/c") {
      try { await Bun.write(TRACE_FILE, ""); } catch {}
      console.log(`${ANSI.green}⏺ Cleared conversation${ANSI.reset}`);
      continue;
    }

    const ctx = await assembleWorkingMemory(input, baseSystemPrompt);
    await agenticLoop(ctx.messages, ctx.systemPrompt, ctx.workingBudget, ctx.bufferEnd, ctx.bufferTurnSizes);
    await saveEpisode(ctx.messages.slice(ctx.bufferEnd));

    console.log();
  }

  rl.close();
  if (globalSandbox) {
    console.log(`${ANSI.dim}Stopping sandbox...${ANSI.reset}`);
    await globalSandbox.stop();
  }
}

main().catch((e) => {
  console.error(`${ANSI.red}Fatal: ${e}${ANSI.reset}`);
  process.exit(1);
});
