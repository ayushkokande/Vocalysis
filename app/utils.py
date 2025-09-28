"""Shared helpers for audio handling and lightweight caching."""
from __future__ import annotations

import io
import json
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, Tuple

import numpy as np

from . import constants

try:  # Optional dependency, improves decoding accuracy.
    import soundfile as sf
except Exception:  # pragma: no cover - fallback when library is missing.
    sf = None

try:  # Resampling convenience.
    import librosa
except Exception:  # pragma: no cover
    librosa = None


@dataclass
class SessionMeta:
    """Metadata persisted per coaching session."""

    session_id: str
    created_at: str
    filename: str
    duration_seconds: float
    goal: str

    @classmethod
    def create(
        cls,
        session_id: str,
        filename: str,
        duration_seconds: float,
        goal: str,
    ) -> "SessionMeta":
        return cls(
            session_id=session_id,
            created_at=datetime.utcnow().isoformat(timespec="seconds"),
            filename=filename,
            duration_seconds=duration_seconds,
            goal=goal,
        )


def ensure_storage() -> None:
    """Make sure local data directories exist before saving anything."""

    constants.SESSION_DIR.mkdir(parents=True, exist_ok=True)
    (constants.MODELS_DIR if hasattr(constants, "MODELS_DIR") else constants.DATA_DIR).mkdir(
        parents=True, exist_ok=True
    )


def _read_audio_from_buffer(buffer: io.BytesIO) -> Tuple[np.ndarray, int]:
    """Decode audio from a bytes buffer using the best available backend."""

    buffer.seek(0)
    if sf is not None:
        data, sample_rate = sf.read(buffer)
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        return data.astype(np.float32), int(sample_rate)

    if librosa is not None:
        buffer.seek(0)
        data, sample_rate = librosa.load(buffer, sr=None, mono=True)
        return data.astype(np.float32), int(sample_rate)

    raise RuntimeError(
        "No audio backend available. Install `soundfile` or `librosa` to continue."
    )


def parse_audio(
    uploaded_file: Any, target_sample_rate: int = constants.DEFAULT_SAMPLE_RATE
) -> Tuple[np.ndarray, int]:
    """Load an uploaded audio file into a mono float32 numpy array."""

    if uploaded_file is None:
        raise ValueError("No file provided")

    raw_bytes = uploaded_file.read() if hasattr(uploaded_file, "read") else uploaded_file
    buffer = io.BytesIO(raw_bytes)
    waveform, sample_rate = _read_audio_from_buffer(buffer)

    if sample_rate != target_sample_rate and librosa is not None:
        waveform = librosa.resample(waveform, orig_sr=sample_rate, target_sr=target_sample_rate)
        sample_rate = target_sample_rate

    normaliser = np.max(np.abs(waveform)) or 1.0
    waveform = (waveform / normaliser).astype(np.float32)
    return waveform, sample_rate


def estimate_duration(samples: np.ndarray, sample_rate: int) -> float:
    """Return audio duration in seconds."""

    if sample_rate <= 0:
        return 0.0
    return float(samples.shape[0] / sample_rate)


def generate_session_id() -> str:
    """Random but human-friendly session id."""

    return uuid.uuid4().hex[:8]


def save_audio(session_id: str, original_name: str, raw_bytes: bytes) -> Path:
    """Persist uploaded audio locally for later review."""

    ensure_storage()
    session_path = constants.SESSION_DIR / f"{session_id}_{original_name}"
    session_path.write_bytes(raw_bytes)
    return session_path


def save_session_manifest(entries: Iterable[SessionMeta]) -> None:
    """Write the session list to disk as JSON."""

    ensure_storage()
    payload = [asdict(entry) for entry in entries]
    manifest_path = constants.SESSION_DIR / "sessions.json"
    manifest_path.write_text(json.dumps(payload, indent=2))


def format_seconds(value: float) -> str:
    """Return m:ss formatting for durations."""

    minutes, seconds = divmod(int(value), 60)
    return f"{minutes:02d}:{seconds:02d}"


def safe_float(value: float) -> float:
    """Clamp NaN/inf to zero for display purposes."""

    if value is None or not np.isfinite(value):
        return 0.0
    return float(value)
