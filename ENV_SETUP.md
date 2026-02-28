# Environment Configuration

This document explains how to configure environment variables for the Event Taxonomy Tracker.

## Quick Start

1. **Copy the environment template:**
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

2. **Add your Anthropic API key:**
   ```bash
   # Edit apps/api/.env and add:
   ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```

3. **Get an API key:**
   - Sign up at [console.anthropic.com](https://console.anthropic.com/)
   - Navigate to Settings → API Keys
   - Create a new key

4. **Start the server:**
   ```bash
   bun run dev
   ```

## Environment Variables

### API Server (`apps/api/`)

The API server uses Bun's built-in environment variable support. Create a `.env` file in `apps/api/` directory.

#### Required (for LLM features)

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key for Claude LLM | `sk-ant-api03-...` |

**Note:** The app will work without this key, but the "Generate from PRD" feature will be disabled.

#### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8000` |
| `HOST` | Server host | `0.0.0.0` |
| `DB_PATH` | Custom SQLite database path | `apps/api/data/event_taxonomy.db` |

### Frontend (`apps/frontend/`)

The frontend currently has no environment variables. API base URL is hardcoded to `http://localhost:8000/api`.

## LLM Configuration

### Current Model

- **Provider:** Anthropic
- **Model:** Claude Sonnet 4.5 (`claude-sonnet-4-20250514`)
- **Purpose:** Event generation from PRDs
- **Cost:** ~$3 per million input tokens, ~$15 per million output tokens

### How It Works

1. User pastes PRD content into a tracking plan
2. Clicks "Generate from PRD" button
3. Backend sends PRD + context to Claude via Vercel AI SDK
4. Claude returns structured JSON with suggested events
5. User reviews, edits, and accepts suggestions

### What's Sent to the LLM

- PRD content (user-provided)
- Guidelines from `apps/api/src/llm/guidelines.md`
- List of existing events (for duplicate detection)
- Property registry (for reuse)
- 10 random example events (for context)
- Tracking plan title

### Privacy & Security

- API key is stored in `.env` (gitignored)
- `.env` files are excluded from version control
- PRD content is sent to Anthropic's API (see [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy))
- No data is stored on Anthropic's servers beyond the API call

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable is not set"

**Cause:** The `.env` file is missing or doesn't contain the API key.

**Solution:**
```bash
cd apps/api
cp .env.example .env
# Edit .env and add your key
```

### "Invalid API key"

**Cause:** The API key is incorrect or expired.

**Solution:**
1. Check your key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Generate a new key if needed
3. Update `apps/api/.env`
4. Restart the server

### Environment variables not loading

**Cause:** Bun loads `.env` from the current working directory.

**Solution:**
Make sure you're running `bun run dev` from the project root, not from `apps/api/`.

The npm scripts are configured to run from the root directory.

## File Structure

```
event-taxonomy-tracker/
├── .env.example              # Root-level example (for reference)
├── .gitignore                # Excludes .env files
└── apps/
    └── api/
        ├── .env.example      # Template with all variables documented
        ├── .env              # Your actual config (gitignored, create this)
        └── src/
            └── llm/
                ├── provider.ts    # Reads ANTHROPIC_API_KEY
                └── guidelines.md  # Editable LLM instructions
```

## Best Practices

1. **Never commit `.env` files** - They contain secrets
2. **Keep `.env.example` updated** - Document all new variables
3. **Use different keys for dev/prod** - Separate API keys per environment
4. **Rotate keys regularly** - Especially if accidentally exposed
5. **Set usage limits** - Configure spending limits in Anthropic console

## Production Deployment

For production environments, set environment variables through your hosting platform:

- **Railway:** Settings → Variables
- **Vercel:** Settings → Environment Variables
- **Fly.io:** `fly secrets set ANTHROPIC_API_KEY=...`
- **Docker:** Use `--env-file` or `-e` flags
- **Systemd:** Use `Environment=` in service file

Do not use `.env` files in production - use platform-specific secret management.
