# Lesson 6: Adding More Tools

## Beyond Reading

We've built a read tool. But agents need to do more than just read data. They need to write, modify, search, and execute actions.

**Here's the key insight: All agents need the same *categories* of tools.**

## Universal Tool Categories

Every useful agent has tools in three categories:

**1. READ** - Get information  
**2. WRITE** - Change state  
**3. EXECUTE** - Perform actions  

**These categories are universal.** Only the specific operations change by domain.

## Tool Categories by Domain

| Category | Coding Agent | Support Agent | Analytics Agent | DevOps Agent |
|----------|--------------|---------------|-----------------|--------------|
| **READ** | read_file<br/>glob<br/>grep | read_ticket<br/>search_kb<br/>list_tickets | query_db<br/>read_csv<br/>get_schema | get_logs<br/>get_metrics<br/>list_services |
| **WRITE** | write_file<br/>edit_file | update_ticket<br/>create_ticket | save_report<br/>update_dashboard | update_config<br/>set_env_var |
| **EXECUTE** | bash | send_email<br/>notify_slack | run_pipeline<br/>generate_chart | restart_service<br/>deploy<br/>scale |

**See the pattern?** The categories stay the same. The implementations change.

## Building Our Coding Agent Tools

We'll add 5 more tools to our coding agent. As you read each one, think about how you'd adapt it for your domain.

### Tool 1: Write File (WRITE category)

\`\`\`typescript
import { writeFile } from "node:fs/promises";

async function writeFileTool(path: string, content: string): Promise<string> {
  try {
    await writeFile(path, content, "utf-8");
    return "ok";
  } catch (err: any) {
    return \`error: \${err.message}\`;
  }
}
\`\`\`

**Schema:**
\`\`\`typescript
{
  name: "write",
  description: "Write content to a file",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to write to" },
      content: { type: "string", description: "Content to write" },
    },
    required: ["path", "content"],
  },
}
\`\`\`

**Other domains:**
\`\`\`typescript
// Support Agent
async function updateTicketTool(ticketId: string, status: string): Promise<string> {
  await database.tickets.update({ id: ticketId }, { status });
  return "ok";
}

// Analytics Agent
async function saveReportTool(name: string, data: string): Promise<string> {
  await storage.saveReport(name, data);
  return "ok";
}

// DevOps Agent
async function updateConfigTool(service: string, key: string, value: string): Promise<string> {
  await kubectl.setConfig(service, key, value);
  return "ok";
}
\`\`\`

### Tool 2: Edit File (WRITE category)

\`\`\`typescript
async function editFileTool(
  path: string,
  old: string,
  newText: string
): Promise<string> {
  try {
    const content = await readFile(path, "utf-8");
    
    if (!content.includes(old)) {
      return "error: old_string not found";
    }
    
    const result = content.replace(old, newText);
    await writeFile(path, result, "utf-8");
    return "ok";
  } catch (err: any) {
    return \`error: \${err.message}\`;
  }
}
\`\`\`

**Schema:**
\`\`\`typescript
{
  name: "edit",
  description: "Replace old text with new text in a file",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to edit" },
      old: { type: "string", description: "Text to find" },
      new: { type: "string", description: "Text to replace with" },
    },
    required: ["path", "old", "new"],
  },
}
\`\`\`

### Tool 3: Glob (READ category)

\`\`\`typescript
async function globTool(pattern: string): Promise<string> {
  const files: string[] = [];
  for await (const file of new Bun.Glob(\`./\${pattern}\`).scan()) {
    files.push(file);
  }
  return files.join("\\n") || "none";
}
\`\`\`

**Schema:**
\`\`\`typescript
{
  name: "glob",
  description: "Find files matching a pattern (e.g. '*.ts', 'src/**/*.js')",
  input_schema: {
    type: "object",
    properties: {
      pat: { type: "string", description: "Glob pattern" },
    },
    required: ["pat"],
  },
}
\`\`\`

**Other domains:**
\`\`\`typescript
// Support Agent
async function searchTicketsTool(query: string): Promise<string> {
  const tickets = await database.tickets.search(query);
  return JSON.stringify(tickets);
}

// Analytics Agent
async function listTablesTool(): Promise<string> {
  const tables = await database.listTables();
  return tables.join("\\n");
}

// DevOps Agent
async function listServicesTool(): Promise<string> {
  const services = await kubectl.getServices();
  return services.join("\\n");
}
\`\`\`

### Tool 4: Grep (READ category)

\`\`\`typescript
async function grepTool(pattern: string): Promise<string> {
  const regex = new RegExp(pattern);
  const hits: string[] = [];
  
  for await (const file of new Bun.Glob("./**").scan()) {
    if (file.includes("node_modules")) continue;
    
    try {
      const content = await readFile(file, "utf-8");
      content.split("\\n").forEach((line, i) => {
        if (regex.test(line)) {
          hits.push(\`\${file}:\${i + 1}:\${line.trim()}\`);
        }
      });
    } catch {}
  }
  
  return hits.slice(0, 50).join("\\n") || "none";
}
\`\`\`

**Schema:**
\`\`\`typescript
{
  name: "grep",
  description: "Search for a regex pattern in files",
  input_schema: {
    type: "object",
    properties: {
      pat: { type: "string", description: "Regex pattern to search for" },
    },
    required: ["pat"],
  },
}
\`\`\`

### Tool 5: Bash (EXECUTE category)

\`\`\`typescript
import { execSync } from "node:child_process";

function bashTool(cmd: string): string {
  try {
    const result = execSync(cmd, {
      encoding: "utf-8",
      timeout: 30000,
    }).trim();
    return result || "(empty)";
  } catch (err: any) {
    return (err.stdout || err.stderr || String(err)).trim();
  }
}
\`\`\`

**Schema:**
\`\`\`typescript
{
  name: "bash",
  description: "Run a shell command and return output",
  input_schema: {
    type: "object",
    properties: {
      cmd: { type: "string", description: "Shell command to execute" },
    },
    required: ["cmd"],
  },
}
\`\`\`

**Other domains:**
\`\`\`typescript
// Support Agent
async function sendEmailTool(to: string, subject: string, body: string): Promise<string> {
  await email.send({ to, subject, body });
  return "sent";
}

// Analytics Agent
async function runPipelineTool(pipeline: string): Promise<string> {
  const result = await dataProcessor.run(pipeline);
  return \`Processed \${result.rows} rows\`;
}

// DevOps Agent
async function restartServiceTool(service: string): Promise<string> {
  await kubectl.restart(service);
  return \`Restarted \${service}\`;
}
\`\`\`

## Creating a Tool Registry

Instead of if/else chains, use a registry:

\`\`\`typescript
const TOOLS_REGISTRY: Record<string, {
  fn: (...args: any[]) => Promise<string> | string;
  schema: any;
}> = {
  read: {
    fn: readFileTool,
    schema: { /* schema here */ },
  },
  write: {
    fn: writeFileTool,
    schema: { /* schema here */ },
  },
  edit: {
    fn: editFileTool,
    schema: { /* schema here */ },
  },
  glob: {
    fn: globTool,
    schema: { /* schema here */ },
  },
  grep: {
    fn: grepTool,
    schema: { /* schema here */ },
  },
  bash: {
    fn: bashTool,
    schema: { /* schema here */ },
  },
};

// Extract just the schemas for API call
const TOOLS = Object.values(TOOLS_REGISTRY).map(t => t.schema);
\`\`\`

**This registry pattern works for all agents.**

## Executing Any Tool

Update your loop to handle any tool:

\`\`\`typescript
for (const call of toolCalls) {
  const tool = TOOLS_REGISTRY[call.name];
  
  if (!tool) {
    toolResults.push({
      type: "tool_result",
      tool_use_id: call.id,
      content: \`error: unknown tool \${call.name}\`,
    });
    continue;
  }
  
  // Call the function with spread parameters
  const params = Object.values(call.input);
  const result = await tool.fn(...params);
  
  toolResults.push({
    type: "tool_result",
    tool_use_id: call.id,
    content: result,
  });
}
\`\`\`

## Test All Tools

\`\`\`typescript
const result = await agenticLoop(\`
  Create a file called hello.ts with a hello world function.
  Then find all .ts files in the current directory.
  Then search for the word 'function' in all files.
\`);

console.log(result);
\`\`\`

Claude will:
1. Use \`write\` to create hello.ts
2. Use \`glob\` to find *.ts files
3. Use \`grep\` to search for "function"
4. Summarize the results

## What We've Built

Your agent now has six powerful tools categorized as:

**READ (Get information):**
- \`read\` - Read files
- \`glob\` - Find files by pattern
- \`grep\` - Search within files

**WRITE (Change state):**
- \`write\` - Create/overwrite files  
- \`edit\` - Modify existing files

**EXECUTE (Perform actions):**
- \`bash\` - Execute shell commands

**This categorization is universal.** Support agents have read/write/execute. Analytics agents have read/write/execute. DevOps agents have read/write/execute.

## 🎯 Exercise: Design YOUR Agent

Now it's your turn. Pick a domain you care about and design 3-6 tools.

### Step 1: Choose Your Domain

- Customer support automation
- Data analysis/reporting
- Social media management
- Infrastructure monitoring
- Content creation
- Research assistant
- E-commerce automation

### Step 2: Design Tools by Category

**READ (What data do you need to get?)**
- List 2-3 read operations

**WRITE (What state changes are needed?)**
- List 1-2 write operations

**EXECUTE (What actions need to be taken?)**
- List 1-2 execute operations

### Step 3: Write the Schema

Use this template:

\`\`\`typescript
const MY_TOOLS = [
  {
    name: "your_tool_name",
    description: "Clear description of what it does",
    input_schema: {
      type: "object",
      properties: {
        param1: { type: "string", description: "Parameter description" },
        param2: { type: "string", description: "Parameter description" },
      },
      required: ["param1"],
    },
  },
  // ... more tools
];
\`\`\`

### Example: Social Media Agent

\`\`\`typescript
const SOCIAL_MEDIA_TOOLS = [
  // READ
  {
    name: "get_mentions",
    description: "Get recent mentions of the brand",
    input_schema: {
      type: "object",
      properties: {
        platform: { type: "string", description: "twitter/instagram/facebook" },
      },
      required: ["platform"],
    },
  },
  {
    name: "analyze_sentiment",
    description: "Analyze sentiment of a post or comment",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to analyze" },
      },
      required: ["text"],
    },
  },
  // WRITE
  {
    name: "create_post",
    description: "Create a new social media post",
    input_schema: {
      type: "object",
      properties: {
        platform: { type: "string" },
        content: { type: "string" },
      },
      required: ["platform", "content"],
    },
  },
  // EXECUTE
  {
    name: "reply_to_mention",
    description: "Reply to a mention or comment",
    input_schema: {
      type: "object",
      properties: {
        mention_id: { type: "string" },
        reply: { type: "string" },
      },
      required: ["mention_id", "reply"],
    },
  },
];
\`\`\`

**The agentic loop works identically. Only the tools change.**

## Next Steps

In the next lesson, we'll add an interactive REPL so you can have conversations with your agent.

This UI pattern is also universal - same REPL works for all agent types.

---

**Key Takeaways:**
- All agents need three tool categories: READ, WRITE, EXECUTE
- The categories are universal; implementations are domain-specific
- Tool registry pattern keeps code organized
- Each tool has a function + schema
- Generic execution works for any tool
- **Design exercise:** Plan tools for YOUR domain
- Agents become powerful with complementary tools
- The pattern transfers to any domain
