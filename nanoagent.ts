#!/usr/bin/env bun
/**
 * nanoagent - minimal agentic coding assistant
 * Demonstrates the ReAct pattern: Reason → Act → Observe → Repeat
 */

// ─── IMPORTS ─────────────────────────────────────────────────────────────────
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as readline from "node:readline";
import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8192;
const SHELL_TIMEOUT = 30000;
const TRACE_FILE = ".nanoagent/trace.jsonl";
const CONTEXT_WINDOW = 200000;
const SYSTEM_PROMPT_OVERHEAD = 500;
const MEMORY_BUDGET = CONTEXT_WINDOW - MAX_TOKENS - SYSTEM_PROMPT_OVERHEAD - 10000; // Reserve 10k for safety

// Sandbox configuration
const USE_SANDBOX = process.env.SANDBOX !== "false"; // Enabled by default
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

// ─── SANDBOX RUNTIME ─────────────────────────────────────────────────────────
class Sandbox {
  private containerId: string | null = null;
  private isRunning: boolean = false;

  async start(): Promise<void> {
    if (this.isRunning) return;

    const name = `nanoagent-sandbox-${randomBytes(8).toString("hex")}`;
    const cwd = process.cwd();

    // Build sandbox image if not exists
    try {
      execSync("docker image inspect nanoagent-sandbox", { stdio: "ignore" });
    } catch {
      console.log(`${ANSI.cyan}Building sandbox image...${ANSI.reset}`);
      execSync("docker build -f Dockerfile.sandbox -t nanoagent-sandbox .", {
        cwd,
        stdio: "inherit",
      });
    }

    const dockerArgs = [
      "run", "-d", "--rm", "--name", name,
      // Security
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--security-opt", "seccomp=default",
      "--network", "none",
      // Filesystem
      "--read-only",
      "--tmpfs", "/tmp:rw,noexec,nosuid,size=100m",
      "--tmpfs", "/workspace:rw,size=500m",
      "-v", `${cwd}:/mnt/host:ro`,
      "-w", "/workspace",
      // Resources
      "--memory", SANDBOX_MEMORY,
      "--memory-swap", SANDBOX_MEMORY,
      "--cpus", SANDBOX_CPUS,
      "--pids-limit", SANDBOX_PIDS.toString(),
      "nanoagent-sandbox",
    ];

    try {
      this.containerId = execSync(dockerArgs.join(" "), {
        encoding: "utf-8",
        timeout: 10000,
      }).trim();
      this.isRunning = true;
    } catch (error: any) {
      throw new Error(`Failed to start sandbox: ${error.message}`);
    }
  }

  async exec(command: string, timeout = SHELL_TIMEOUT): Promise<ExecResult> {
    if (!this.isRunning || !this.containerId) {
      throw new Error("Sandbox not running");
    }

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const proc = spawn("docker", ["exec", this.containerId!, "bash", "-c", command]);

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill("SIGKILL");
      }, timeout);

      proc.stdout.on("data", (data) => (stdout += data.toString()));
      proc.stderr.on("data", (data) => (stderr += data.toString()));

      proc.on("close", (code) => {
        clearTimeout(timer);
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? -1,
          timedOut,
        });
      });

      proc.on("error", (error) => {
        clearTimeout(timer);
        resolve({
          stdout: stdout.trim(),
          stderr: error.message,
          exitCode: -1,
          timedOut,
        });
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.containerId) return;

    try {
      execSync(`docker stop ${this.containerId}`, {
        stdio: "ignore",
        timeout: 5000,
      });
    } catch {
      try {
        execSync(`docker rm -f ${this.containerId}`, { stdio: "ignore" });
      } catch {}
    }

    this.isRunning = false;
    this.containerId = null;
  }

  async health(): Promise<boolean> {
    if (!this.containerId) return false;

    try {
      const result = execSync(`docker inspect -f '{{.State.Running}}' ${this.containerId}`, {
        encoding: "utf-8",
        timeout: 1000,
      }).trim();
      return result === "true";
    } catch {
      return false;
    }
  }
}

// Singleton sandbox instance for session persistence
let globalSandbox: Sandbox | null = null;

async function getSandbox(): Promise<Sandbox> {
  if (!USE_SANDBOX) {
    throw new Error("Sandbox disabled");
  }

  if (!globalSandbox) {
    globalSandbox = new Sandbox();
    await globalSandbox.start();

    // Cleanup on exit
    process.on("exit", () => globalSandbox?.stop());
    process.on("SIGINT", async () => {
      await globalSandbox?.stop();
      process.exit(0);
    });
    process.on("SIGTERM", async () => {
      await globalSandbox?.stop();
      process.exit(0);
    });
  }

  // Verify sandbox is still healthy
  const healthy = await globalSandbox.health();
  if (!healthy) {
    await globalSandbox.stop();
    globalSandbox = new Sandbox();
    await globalSandbox.start();
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
      if (USE_SANDBOX) {
        try {
          const sandbox = await getSandbox();
          const result = await sandbox.exec(args.cmd);

          if (result.timedOut) {
            return `error: command timed out after ${SHELL_TIMEOUT}ms`;
          }

          if (result.exitCode !== 0) {
            return result.stderr || result.stdout || `error: exit code ${result.exitCode}`;
          }

          return result.stdout || "(empty)";
        } catch (err: any) {
          return `error: ${err.message}`;
        }
      }

      // Fallback to host execution (not recommended)
      try {
        return execSync(args.cmd, { encoding: "utf-8", timeout: SHELL_TIMEOUT }).trim() || "(empty)";
      } catch (err: any) {
        return (err.stdout || err.stderr || String(err)).trim();
      }
    },
  },
};

// ─── TOOL EXECUTION ──────────────────────────────────────────────────────────
async function executeTool(name: string, input: any): Promise<string> {
  try {
    const tool = TOOLS[name];
    if (!tool) return `error: unknown tool ${name}`;
    return await tool.fn(input);
  } catch (err: any) {
    return String(err);
  }
}

function buildToolSchema() {
  return Object.entries(TOOLS).map(([name, { desc, params }]) => {
    const required = params.filter(p => !p.endsWith("?")).map(p => p.replace("?", ""));
    const allParams = params.map(p => p.replace("?", ""));
    
    const properties = Object.fromEntries(allParams.map((p) => {
      if (p === "all") return [p, { type: "boolean" }];
      if (p === "offset" || p === "limit") return [p, { type: "integer" }];
      return [p, { type: "string" }];
    }));
    
    return {
      name,
      description: desc,
      input_schema: {
        type: "object",
        properties,
        required,
      },
    };
  });
}

// ─── MEMORY ──────────────────────────────────────────────────────────────────
const tokenizer = new Tiktoken(cl100k_base);

function countTokens(text: string): number {
  return tokenizer.encode(text).length;
}

async function saveToTrace(turn: { timestamp: string; user: string; assistant: any }) {
  await mkdir(".nanoagent", { recursive: true });
  const line = JSON.stringify(turn) + "\n";
  await Bun.write(TRACE_FILE, line, { append: true });
}

async function loadTrace(): Promise<{ messages: Message[]; stats: { total: number; loaded: number; tokens: number } }> {
  try {
    const content = await readFile(TRACE_FILE, "utf-8");
    const lines = content.trim().split("\n");
    
    const messages: Message[] = [];
    let tokens = 0;
    let loaded = 0;
    
    // Load from most recent backwards until budget exceeded
    for (let i = lines.length - 1; i >= 0; i--) {
      const turn = JSON.parse(lines[i]);
      
      // Count tokens for this turn
      const userTokens = countTokens(turn.user);
      const assistantTokens = countTokens(JSON.stringify(turn.assistant));
      const turnTokens = userTokens + assistantTokens;
      
      // Check if adding this turn would exceed budget
      if (tokens + turnTokens > MEMORY_BUDGET) {
        break; // Stop loading, we've hit the limit
      }
      
      // Add to beginning (since we're going backwards)
      messages.unshift({ role: "assistant", content: turn.assistant });
      messages.unshift({ role: "user", content: turn.user });
      tokens += turnTokens;
      loaded++;
    }
    
    return { 
      messages, 
      stats: { 
        total: lines.length, 
        loaded, 
        tokens 
      } 
    };
  } catch {
    return { 
      messages: [], 
      stats: { total: 0, loaded: 0, tokens: 0 } 
    };
  }
}

// ─── LLM INTERFACE ───────────────────────────────────────────────────────────
async function callLLM(messages: Message[], systemPrompt: string) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
      tools: buildToolSchema(),
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

// ─── AGENTIC LOOP ────────────────────────────────────────────────────────────
/**
 * The ReAct Pattern:
 * 1. REASON: LLM decides what to do based on context
 * 2. ACT: LLM calls tools to take action
 * 3. OBSERVE: Tool results are added to context
 * 4. REPEAT: Loop continues until LLM responds without tools
 */
async function agenticLoop(messages: Message[], systemPrompt: string): Promise<void> {
  while (true) {
    // REASON: Ask LLM what to do next
    const response = await callLLM(messages, systemPrompt);
    
    // Check for text output
    const textBlocks = response.content.filter((b: any) => b.type === "text");
    for (const block of textBlocks) {
      console.log(`\n${ANSI.cyan}⏺${ANSI.reset} ${block.text}`);
    }
    
    // ACT: Execute any tool calls (in parallel when multiple)
    const toolCalls = response.content.filter((b: any) => b.type === "tool_use");
    const toolResults: any[] = [];
    
    if (toolCalls.length > 0) {
      // Display what tools are being called
      for (const call of toolCalls) {
        const preview = String(Object.values(call.input)[0] ?? "").slice(0, 50);
        console.log(`\n${ANSI.green}⏺ ${call.name}${ANSI.reset}(${ANSI.dim}${preview}${ANSI.reset})`);
      }
      
      // Execute all tools in parallel
      const results = await Promise.all(
        toolCalls.map(call => executeTool(call.name, call.input))
      );
      
      // Display results and build tool_result blocks
      for (let i = 0; i < toolCalls.length; i++) {
        const call = toolCalls[i];
        const result = results[i];
        
        const lines = result.split("\n");
        const resultPreview = lines[0].slice(0, 60) + (lines.length > 1 ? ` +${lines.length - 1} lines` : "");
        console.log(`  ${ANSI.dim}⎿  ${resultPreview}${ANSI.reset}`);
        
        toolResults.push({ type: "tool_result", tool_use_id: call.id, content: result });
      }
    }
    
    // Add assistant response to conversation
    messages.push({ role: "assistant", content: response.content });
    
    // OBSERVE: If no tools were called, agent is done
    if (toolResults.length === 0) break;
    
    // REPEAT: Feed tool results back to LLM
    messages.push({ role: "user", content: toolResults });
  }
}

// ─── REPL / UI ───────────────────────────────────────────────────────────────
async function main() {
  // Validate API key early
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${ANSI.red}Error: ANTHROPIC_API_KEY not set${ANSI.reset}`);
    console.error(`${ANSI.dim}Set it in .env file or environment${ANSI.reset}`);
    process.exit(1);
  }
  
  const oneOffPrompt = process.argv[2];
  
  // One-off mode: run single prompt and exit
  if (oneOffPrompt) {
    const { messages } = await loadTrace();
    const systemPrompt = `Concise coding assistant. cwd: ${process.cwd()}${USE_SANDBOX ? "\n\nSECURITY: bash commands run in sandboxed Docker container (no network, read-only host files, 512MB RAM, 1 CPU)." : ""}`;
    
    messages.push({ role: "user", content: oneOffPrompt });
    await agenticLoop(messages, systemPrompt);
    
    await saveToTrace({
      timestamp: new Date().toISOString(),
      user: oneOffPrompt,
      assistant: messages[messages.length - 1].content,
    });
    
    return;
  }
  
  // Interactive REPL mode
  console.log(`
${ANSI.bold}${ANSI.cyan}nanoagent${USE_SANDBOX ? " 🐳" : ""}${ANSI.reset}
${ANSI.dim}${MODEL}${ANSI.reset} | ${ANSI.dim}${process.cwd()}${ANSI.reset}${USE_SANDBOX ? ` | ${ANSI.green}sandboxed${ANSI.reset}` : ""}
`);

  const { messages, stats } = await loadTrace();
  
  if (stats.loaded > 0) {
    console.log(`${ANSI.dim}Loaded ${stats.loaded}/${stats.total} turns (${stats.tokens.toLocaleString()} tokens)${ANSI.reset}`);
    if (stats.loaded < stats.total) {
      console.log(`${ANSI.dim}${stats.total - stats.loaded} older turns excluded to stay within memory budget${ANSI.reset}`);
    }
  }
  
  const systemPrompt = `Concise coding assistant. cwd: ${process.cwd()}`;
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
      messages.length = 0;
      console.log(`${ANSI.green}⏺ Cleared conversation${ANSI.reset}`);
      continue;
    }
    
    messages.push({ role: "user", content: input });
    await agenticLoop(messages, systemPrompt);
    
    // Save this turn to trace
    await saveToTrace({
      timestamp: new Date().toISOString(),
      user: input,
      assistant: messages[messages.length - 1].content,
    });
    
    console.log();
  }
  
  rl.close();
  
  // Cleanup sandbox
  if (globalSandbox) {
    console.log(`${ANSI.dim}Stopping sandbox...${ANSI.reset}`);
    await globalSandbox.stop();
  }
}

main().catch((e) => {
  console.error(`${ANSI.red}Fatal: ${e}${ANSI.reset}`);
  process.exit(1);
});
