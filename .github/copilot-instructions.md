# Copilot / AI agent instructions (auto-generated draft)

Purpose: help AI coding agents be immediately productive in this repository.

NOTE: when this file was generated there were no discoverable source files (README.md, package manifests, or typical language files). Before making edits, confirm repository contents with a quick file listing.

- **First steps:** list files, then open these if present: README.md, pyproject.toml, requirements.txt, package.json, Dockerfile, notebooks/, src/, tests/.

- **Detect languages & tooling:**
  - Python: presence of `.py`, `requirements.txt`, `pyproject.toml`, `environment.yml` → use `python -m pip install -r requirements.txt` or `poetry install` and run tests with `pytest`.
  - Node: `package.json` → use `npm install` and `npm test`.
  - Jupyter: `.ipynb` files → prefer small, reproducible script edits and add unit-tests rather than editing notebooks directly.

- **Repository layout assumptions (update if different):**
  - Code: `src/` or top-level `.py`/`.js` files
  - Notebooks: `notebooks/`
  - Data: `data/` (do not commit large datasets)
  - Tests: `tests/` (pytest) or `__tests__` (jest)

- **What to change / how to propose edits:**
  - Make minimal, focused edits. Add or update tests for behavior changes.
  - Create a branch and include a short PR description with the motivation and quick validation steps.

- **Safety & size rules:**
  - Never add large binary data into the repo. Use external storage and reference paths.
  - Run unit tests locally before proposing changes. If tests are missing, add a small test that demonstrates the fix.

- **When you find config files, follow them:**
  - If `pyproject.toml` exists, prefer Poetry workflows.
  - If a `Makefile` or `tasks.json` defines dev commands, follow those exact commands for builds/tests.

- **Examples to replace with repo-specific commands (edit this file when you detect them):**
  - Python install: `python -m pip install -r requirements.txt`
  - Run tests: `python -m pytest -q`
  - Run linter: `flake8 src/` or `eslint .`

- **When merging into this file:** preserve any hand-authored guidance. If this file already exists, merge by keeping project-specific commands and examples, and append agent-detection steps.

If anything in this draft is unclear or you want project-specific guidance added, tell me which files contain the canonical build/test commands and I'll update this file to include exact examples.
