"""Centralised constants and enums used across the Vocalysis app."""
from __future__ import annotations

from enum import Enum
from pathlib import Path


APP_TITLE = "Vocalysis — Multi-Agent Vocal Coach"
DEFAULT_SAMPLE_RATE = 16000
DEFAULT_FRAME_SIZE = 2048
DEFAULT_HOP_LENGTH = 512
PEAK_ENERGY_THRESHOLD = 0.75
RECENT_SESSION_LIMIT = 8

DATA_DIR = Path("data")
SESSION_DIR = DATA_DIR / "sessions"
MODELS_DIR = Path("models")
MEMORY_STORE_PATH = SESSION_DIR / "session_memory.json"


class PracticeGoal(str, Enum):
    """High-level training goals a singer can pick from."""

    INTONATION = "Intonation Accuracy"
    BREATH = "Breath Support"
    RANGE = "Range Expansion"
    EXPRESSIVITY = "Expressivity"
    CONFIDENCE = "Performance Confidence"


class VocalTrait(str, Enum):
    """Traits surfaced by the interpreter agent."""

    PITCH_CONTROL = "Pitch Control"
    DYNAMICS = "Dynamic Control"
    TIMBRE_BALANCE = "Timbre Balance"
    RHYTHMIC_STEADINESS = "Rhythmic Steadiness"
    PHRASE_SHAPING = "Phrase Shaping"
    VIBRATO_CONTROL = "Vibrato Control"
    BREATH_MANAGEMENT = "Breath Management"
    TONE_CLARITY = "Tone Clarity"
    ARTICULATION = "Articulation Precision"
    EMOTIONAL_IMPACT = "Emotional Impact"


COACHING_TIPS = {
    PracticeGoal.INTONATION: "Focus on aligning pitch centres; use a tuner or drone for reference.",
    PracticeGoal.BREATH: "Think in longer phrases and plan breaths; engage diaphragm support.",
    PracticeGoal.RANGE: "Warm up gently into the target range; avoid sudden jumps beyond comfort.",
    PracticeGoal.EXPRESSIVITY: "Experiment with dynamics and vowel colour to storytelling more vividly.",
    PracticeGoal.CONFIDENCE: "Visualise performance scenarios and anchor on supportive thoughts.",
}


class SessionStatus(str, Enum):
    """Lifecycle for a coaching session."""

    CREATED = "created"
    ANALYSED = "analysed"
    FEEDBACK_READY = "feedback_ready"


PLOTLY_THEMES = {
    "background": "#0f172a",
    "text": "#e2e8f0",
    "accent": "#36bffa",
    "secondary": "#22d3ee",
}


class VocalEmotion(str, Enum):
    """High-level mood labels derived from acoustic cues."""

    RADIANT = "Radiant"
    ENERGISED = "Energised"
    SOOTHING = "Soothing"
    INTROSPECTIVE = "Introspective"
    DRAMATIC = "Dramatic"


__all__ = [
    "APP_TITLE",
    "DEFAULT_SAMPLE_RATE",
    "DEFAULT_FRAME_SIZE",
    "DEFAULT_HOP_LENGTH",
    "PEAK_ENERGY_THRESHOLD",
    "RECENT_SESSION_LIMIT",
    "DATA_DIR",
    "SESSION_DIR",
    "MODELS_DIR",
    "MEMORY_STORE_PATH",
    "PracticeGoal",
    "VocalTrait",
    "VocalEmotion",
    "COACHING_TIPS",
    "SessionStatus",
    "PLOTLY_THEMES",
]
