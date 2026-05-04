# SkyBridgeCX Agents

Custom Claude / Cowork subagents for the SkyBridgeCX team. Each file in this directory is a self-contained agent definition (system prompt + tool allowlist + invocation patterns).

## How to install

Claude Code and Cowork pick up agent definitions from `.claude/agents/`. Copy or symlink the files in this directory into your local `.claude/agents/`:

```bash
mkdir -p .claude/agents
cp agents/*.md .claude/agents/
```

(or symlink: `ln -s ../../agents/skybridge-outreach.md .claude/agents/skybridge-outreach.md`)

After install, the agents become invokable via the `Agent` tool with `subagent_type: "<name>"`, where `<name>` matches the `name:` field in the agent's frontmatter.

## Available agents

### `skybridge-outreach`

Senior-SDR-grade outreach operator. Reads `docs/OUTREACH_PLAYBOOK.md` on every run and drives pipeline against home-services SMBs (HVAC / plumbing / electrical / roofing). Use it for:

- Sourcing prospects (Apollo / Common Room / web research fallback)
- Drafting and sending the multi-touch email sequence
- Triaging replies (Hot / Warm / Switching / Cold / Suppression)
- Prepping for live demos with company-specific briefs
- Handling objections from the playbook library
- Weekly pipeline review and Friday report

Invocation example:

```
Agent({
  subagent_type: "skybridge-outreach",
  description: "Source 50 HVAC prospects in Phoenix",
  prompt: "Build me a list of 50 HVAC owner-operators in Phoenix that match our ICP (1-10 employees, after-hours closed, recent reviews mentioning missed calls). Save the CSV under docs/outreach/."
})
```

The agent will read the playbook, apply ICP filters, and return a CSV path. It will not send anything without an explicit go-ahead unless Mo authorizes batch send.

## Adding new agents

1. Drop a markdown file here with the standard frontmatter (`name`, `description`, `tools`, optional `model`).
2. Copy/symlink into `.claude/agents/`.
3. Document it in this README.
4. Reference any relevant playbooks in `docs/` so the agent has a source of truth.
