#!/usr/bin/env bun
/**
 * nanoagent - minimal agentic coding assistant
 * Demonstrates the ReAct pattern: Reason → Act → Observe → Repeat
 */

// ─── IMPORTS ─────────────────────────────────────────────────────────────────
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import * as readline from "node:readline";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8192;
const SHELL_TIMEOUT = 30000;

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

// ─── TOOLS ───────────────────────────────────────────────────────────────────
const TOOLS: Record<string, Tool> = {
  read: {
    desc: "Read file with line numbers",
    params: ["path"],
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
    desc: "Replace old with new in file",
    params: ["path", "old", "new"],
    fn: async (args) => {
      const content = await readFile(args.path, "utf-8");
      if (!content.includes(args.old)) return "error: old_string not found";
      const escaped = args.old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const count = (content.match(new RegExp(escaped, "g")) ?? []).length;
      if (!args.all && count > 1) return `error: old_string appears ${count} times`;
      const result = args.all ? content.split(args.old).join(args.new) : content.replace(args.old, args.new);
      await writeFile(args.path, result, "utf-8");
      return "ok";
    },
  },
  glob: {
    desc: "Find files by pattern",
    params: ["pat"],
    fn: async (args) => {
      const files: string[] = [];
      for await (const file of new Bun.Glob(`${args.path ?? "."}/${args.pat}`).scan()) {
        files.push(file);
      }
      return files.join("\n") || "none";
    },
  },
  grep: {
    desc: "Search files for regex",
    params: ["pat"],
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
    desc: "Run shell command",
    params: ["cmd"],
    fn: (args) => {
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
  const tool = TOOLS[name];
  if (!tool) return `error: unknown tool ${name}`;
  return await tool.fn(input);
}

function buildToolSchema() {
  return Object.entries(TOOLS).map(([name, { desc, params }]) => ({
    name,
    description: desc,
    input_schema: {
      type: "object",
      properties: Object.fromEntries(params.map((p) => [p, { type: "string" }])),
      required: params,
    },
  }));
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
  console.log(`
${ANSI.bold}${ANSI.cyan}nanoagent${ANSI.reset}
${ANSI.dim}${MODEL}${ANSI.reset} | ${ANSI.dim}${process.cwd()}${ANSI.reset}
`);

  const messages: Message[] = [];
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
    console.log();
  }
  
  rl.close();
}

main().catch((e) => {
  console.error(`${ANSI.red}Fatal: ${e}${ANSI.reset}`);
  process.exit(1);
});
