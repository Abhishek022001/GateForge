# Project Rules & Security Policy

## Strict Environment & Secret Protection Rule

1. **No Access to `.env` Files**:
   - The AI assistant **does not have permission** to read, access, print, display, inspect, edit, or expose any `.env` file or environment credential file (including `.env`, `backend/.env`, `frontend/.env`, or any other local secret file) under **any situation or request**, whether directly or indirectly.
   - When environment variables need to be set, configured, or updated, the assistant must instruct the user to edit or check their `.env` file locally themselves, rather than inspecting or touching the file.

2. **Zero-Knowledge Secret Policy**:
   - Never log, echo, commit, or print API keys, passwords, database connection strings, or OAuth client secrets in chat, logs, or code artifacts.
