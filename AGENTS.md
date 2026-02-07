# AGENTS

Purpose: instructions for automated coding agents and contributors working in this repo.

## 0) Golden rules
- Keep changes minimal and focused.
- Prefer existing patterns over inventing new ones.
- Update tests/docs when behavior changes.
- Never commit secrets. Never edit generated files.

## 1) Commands

### Install Environment
```sh
uv venv --python 3.12
```

### Activate Environment
```sh
source .venv/bin/activate
```

### Compress
```sh
sh compress.sh
```

### Run
```sh
sh run.sh [compressed file]
```

## 2) Definition of "done"
- Tests added/updated
- Lint/format passes
- No debug prints / dead code
- Docs updated (README/CHANGELOG) if needed
- CI should pass

## 3) Repo Map
src/ — what lives here
tests/ — how tests are organized
minigame_docs/ — minigame specifications

## 4) Architecture (30-second overview)
src/ should contain all necessary files to run the game
tests/ should be where unit tests for specific games should go
minigames/ is where the documentation for the mini-games implemented in src/ should go