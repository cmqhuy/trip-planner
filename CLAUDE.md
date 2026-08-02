# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@GEMINI.md

---

## Long-Running Roadmap

This project follows a multi-month roadmap that spans many sessions.

- Planning docs live in `.planning/` (a separate **private** repo, gitignored here).
- **At session start**: read `.planning/ROADMAP.md` (the *Current Status* block at the top) and
  `.planning/DECISIONS.md` before proposing work. Don't re-derive settled decisions.
- **At session end**: update the *Current Status* block and commit both repos.
- **All work goes on a feature branch** — pushing to `main` auto-deploys to production
  via `.github/workflows/deploy.yml`. Never commit directly to `main`.

If `.planning/` is missing (fresh clone), say so rather than guessing at the roadmap.
