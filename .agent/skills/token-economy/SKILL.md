---
name: token-economy
description: Optimize token usage and reduce operational costs during complex coding tasks. Triggers when handling large files, long logs, or multiple file edits. Use to increase session longevity and performance.
---

# Token Economy Skill

This skill implements advanced strategies for reducing token consumption in the Antigravity agentic environment.

## 🧠 Core Principles

1. **Precision over Bulk**: Never rewrite a whole file if a targeted edit is possible.
2. **Context Hygiene**: Summarize logs and research results before incorporating them into the main chat.
3. **Lazy Loading**: Only read the lines of a file that are strictly necessary for the current task.
4. **Knowledge Leverage**: Use existing Knowledge Items (KIs) to avoid re-researching core architectural patterns.

## 🛠️ Execution Protocol

### 1. File Editing (Highest Priority)
ALWAYS prefer `replace_file_content` or `multi_replace_file_content` over `write_to_file` for existing files.
- **Rule**: If the edit affects < 70% of the file, use a targeted replacement.
- **Benefit**: Saves thousands of tokens by not re-sending unchanged parts of the codebase.

### 2. Log & Terminal Management
NEVER include more than 50 lines of successful terminal output in your response.
- **Strategy**: 
    - Use `command_status` with small `OutputCharacterCount`.
    - If a command succeeds, just state "Command successful" and summarize the outcome.
    - If a command fails, extract ONLY the relevant error stack trace.

### 3. Smart File Reading
When using `view_file` on large files (>300 lines):
- Start by reading the first 100 lines to understand the structure.
- Use `view_file` with `StartLine` and `EndLine` for subsequent reads if you know exactly what function/class you need.

### 4. Planning & Brainstorming
- Eliminate "yapping". Keep implementation plans (artifacts) strictly technical.
- Use Mermaid diagrams for architecture instead of long prose descriptions.
- Combine multiple small tool calls into one turn whenever possible (parallel tool calls).

## 🚀 Optimization Workflow
When the `token-economy` skill is active, the agent MUST:
1. **Analyze**: Identify the absolute minimum context needed.
2. **Filter**: Remove duplicate or redundant information from tool outputs.
3. **Execute**: Use the most token-efficient tool for the job.
4. **Report**: Periodically inform the user of significant token savings (e.g., "Saved ~2k tokens by using targeted edits").
