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

# Current Scope
This repository currently implements the main game framework plus one playable mini-game:
- 90-second playable session shell
- timer/score HUD
- swipe-up skip gesture handling
- adaptive mini-game weighting infrastructure
- success popup + confetti feedback hooks
- playable lightbulb screwing mini-game
- placeholder cards for burger/pipe/plant slots
