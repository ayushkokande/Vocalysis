# Vocalysis — Multi-Agent Vocal Coach

Python multi-agent audio pipeline with both a Streamlit prototype and a new React + FastAPI experience.

## Features
- Upload a rehearsal or performance take and receive instant analysis
- Deep signal descriptors: vibrato shape, harmonic/percussive balance, spectral statistics
- Emotion heuristic that classifies the delivery (radiant, introspective, dramatic, etc.)
- Configurable practice goals that tailor coaching tips
- Lightweight JSON memory that stores recent sessions and feedback
- Interactive "Choir Room" with speech-driven drills and AI mentor prompts
- Microphone or file-upload analysis that pipes real takes through the FastAPI backend

## Getting Started

### Backend (FastAPI)
1. **Install dependencies**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. **Run the API**
   ```bash
   uvicorn app.api:app --host 127.0.0.1 --port 8000 --reload
   ```

### Frontend (React + Vite)
1. ```bash
   cd frontend
   npm install
   npm run dev -- --host 127.0.0.1 --port 5173
   ```
2. Visit `http://127.0.0.1:5173` and upload audio to trigger the pipeline.

By default the React client calls `http://localhost:8000`. Override via `.env` in `frontend/`:
```
VITE_API_BASE=http://127.0.0.1:8000
```

### Legacy Streamlit prototype
The original Streamlit UI still runs if you prefer the old flow:
```bash
streamlit run app/main.py
```

## Project Layout
```
vocalysis/
├── app/
│   ├── api.py           # FastAPI interface consumed by the React app
│   ├── main.py          # Streamlit UI entrypoint
│   ├── constants.py     # Tunable defaults & enums
│   ├── listener.py      # Audio descriptor extraction
│   ├── interpreter.py   # Heuristic mapping to vocal traits
│   ├── emotion.py       # Mood inference from acoustic cues
│   ├── mentor.py        # Coaching feedback synthesiser
│   ├── memory.py        # JSON-backed session history
│   ├── visualizer.py    # Plotly helper charts
│   └── utils.py         # Audio I/O helpers, session metadata
├── data/
│   └── sessions/        # Stored audio + memory JSON (auto-created)
├── models/
│   └── cache/           # Reserved for model weights (optional)
├── requirements.txt
├── frontend/            # React (Vite) client for the coaching dashboard
└── README.md
```

## Extending The Scaffold
- Swap in higher-fidelity pitch tracking (e.g. Crepe/Parselmouth) inside `listener.py`
- Route insights to GPT-based agents for conversational coaching in `mentor.py`
- Persist richer analytics (lyrics, phoneme timings) in `memory.py`
- Add authentication or multi-user separation via Streamlit secrets.

Happy hacking!
