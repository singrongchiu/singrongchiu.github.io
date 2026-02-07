# Setup
```sh
uv venv --python 3.12
source .venv/bin/activate
```

# Run Tests
```sh
source .venv/bin/activate
pytest -q
```

# Build Compressed Artifacts
```sh
sh compress.sh
```

# Run Locally
```sh
sh run.sh src.tar.br
```
Open [http://localhost:8000/src/index.html](http://localhost:8000/src/index.html).

# Framework-Only Scope
This repository currently implements the main game framework only:
- 90-second playable session shell
- timer/score HUD
- swipe-up skip gesture handling
- adaptive mini-game weighting infrastructure
- success popup + confetti feedback hooks
- placeholder mini-game cards only (no actual mini-game mechanics)
