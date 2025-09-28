"""FastAPI backend exposing the Vocalysis agents for a React client."""
from __future__ import annotations

from typing import Dict, List, Optional

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import constants, emotion, interpreter, listener, mentor, memory, utils, coaching
import json

app = FastAPI(title=constants.APP_TITLE, version="0.1.0")

# Relaxed CORS to aid local frontend development; tighten for production deployments.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_listener = listener.ListenerAgent()
_interpreter = interpreter.InterpreterAgent()
_mentor = mentor.MentorAgent()
_emotion = emotion.EmotionAgent()
_memory = memory.MemoryStore()


class SessionMetaModel(BaseModel):
    session_id: str
    created_at: str
    filename: str
    duration_seconds: float
    goal: str


class InsightModel(BaseModel):
    trait: str
    status: str
    detail: Optional[str] = Field(default=None)


class MentorFeedbackModel(BaseModel):
    headline: str
    actions: List[str]
    encouragement: str


class ListeningModel(BaseModel):
    features: Dict[str, float]
    pitch_contour: List[Optional[float]]
    pitch_times: List[float]
    pitch_voiced_flags: List[float]
    pitch_voiced_probabilities: List[float]
    rms_envelope: List[float]
    rms_times: List[float]


class EmotionModel(BaseModel):
    primary: str
    intensity: float
    explanation: str
    scores: Dict[str, float]


class AnalysisResponse(BaseModel):
    meta: SessionMetaModel
    listening: ListeningModel
    insights: List[InsightModel]
    feedback: MentorFeedbackModel
    emotion: EmotionModel
    coach_message: Optional[str] = None
    coach_actions: Optional[List[str]] = None


def _serialise_array(values: np.ndarray, allow_nan: bool = False) -> List[Optional[float]]:
    array = np.asarray(values, dtype=np.float32)
    if allow_nan:
        return [float(v) if np.isfinite(v) else None for v in array]
    return [float(v) for v in array if np.isfinite(v)]


def _resolve_goal(raw_goal: str) -> constants.PracticeGoal:
    try:
        return constants.PracticeGoal(raw_goal)
    except ValueError:
        try:
            return constants.PracticeGoal[raw_goal]
        except KeyError as exc:  # pragma: no cover - validation surface
            raise HTTPException(status_code=400, detail="Invalid practice goal supplied.") from exc


@app.get("/health")
def health() -> Dict[str, str]:
    """Simple health probe for uptime checks."""

    return {"status": "ok"}


@app.get("/history", response_model=List[AnalysisResponse])
def history() -> List[AnalysisResponse]:
    """Return recent session history."""

    entries = _memory.get_recent()
    responses: List[AnalysisResponse] = []
    for entry in entries:
        session = entry.get("session", {})
        listening_entry = entry.get("listening", {})
        emotion_entry = entry.get("emotion") or {
            "primary": constants.VocalEmotion.SOOTHING.value,
            "intensity": 0.0,
            "explanation": "No emotion data stored for this session.",
            "scores": {},
        }
        responses.append(
            AnalysisResponse(
                meta=SessionMetaModel(**session),
                listening=ListeningModel(
                    features={k: float(v) for k, v in listening_entry.get("features", {}).items()},
                    pitch_contour=listening_entry.get("pitch_contour", []),
                    pitch_times=listening_entry.get("pitch_times", []),
                    pitch_voiced_flags=listening_entry.get("pitch_voiced_flags", []),
                    pitch_voiced_probabilities=listening_entry.get("pitch_voiced_probabilities", []),
                    rms_envelope=listening_entry.get("rms_envelope", []),
                    rms_times=listening_entry.get("rms_times", []),
                ),
                insights=[InsightModel(**item) for item in entry.get("insights", [])],
                feedback=MentorFeedbackModel(**entry.get("feedback", {})),
                emotion=EmotionModel(**emotion_entry),
                coach_message=entry.get("coach_message"),
            )
        )
    return responses


@app.post("/analyse", response_model=AnalysisResponse)
async def analyse(
    file: UploadFile = File(...),
    goal: str = Form(...),
    focus_traits: Optional[str] = Form(None),
) -> AnalysisResponse:
    """Analyse an uploaded vocal take and return coaching insights."""

    raw_audio = await file.read()
    if not raw_audio:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        waveform, sample_rate = utils.parse_audio(raw_audio)
    except Exception as exc:  # pragma: no cover - validation surface
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    practice_goal = _resolve_goal(goal)

    focus_list: Optional[List[str]] = None
    if focus_traits:
        try:
            parsed = json.loads(focus_traits)
            if isinstance(parsed, str):
                focus_list = [parsed]
            elif isinstance(parsed, list):
                focus_list = [str(item) for item in parsed]
        except json.JSONDecodeError:
            focus_list = [item.strip() for item in focus_traits.split(',') if item.strip()]

    listening_result = _listener.analyse(waveform, sample_rate)
    insights = _interpreter.interpret(listening_result.features, practice_goal, focus_traits=focus_list)
    emotion_result = _emotion.infer(listening_result.features)
    if emotion_result:
        insights.append(
            {
                "trait": constants.VocalTrait.EMOTIONAL_IMPACT.value,
                "status": emotion_result.get("primary", ""),
                "detail": emotion_result.get("explanation", ""),
            }
        )
    feedback = _mentor.craft_feedback(insights, practice_goal, emotion_result)
    coach_result = coaching.build_coach_message(
        listening_result.features,
        insights,
        feedback,
        practice_goal,
    )
    coach_message = None
    coach_actions: List[str] | None = None
    coach_encouragement = None
    if coach_result:
        coach_message, coach_actions, coach_encouragement = coach_result
        if coach_actions:
            feedback = {
                **feedback,
                "actions": coach_actions,
            }
        if coach_encouragement:
            feedback = {
                **feedback,
                "encouragement": coach_encouragement,
            }

    session_id = utils.generate_session_id()
    duration = utils.estimate_duration(waveform, sample_rate)
    meta = utils.SessionMeta.create(
        session_id,
        file.filename or "take.wav",
        duration,
        practice_goal.value,
    )

    utils.save_audio(session_id, file.filename or "take.wav", raw_audio)

    history_record = {
        "session": meta.__dict__,
        "listening": {
            "features": {k: float(v) for k, v in listening_result.features.items()},
            "pitch_contour": _serialise_array(listening_result.pitch_contour, allow_nan=True),
            "pitch_times": _serialise_array(listening_result.pitch_times),
            "pitch_voiced_flags": _serialise_array(listening_result.pitch_voiced_flags),
            "pitch_voiced_probabilities": _serialise_array(
                listening_result.pitch_voiced_probabilities
            ),
            "rms_envelope": _serialise_array(listening_result.rms_envelope),
            "rms_times": _serialise_array(listening_result.rms_times),
        },
        "insights": insights,
        "feedback": feedback,
        "emotion": emotion_result,
        "coach_message": coach_message,
        "coach_actions": coach_actions,
    }
    _memory.add(history_record)

    return AnalysisResponse(
        meta=SessionMetaModel(**meta.__dict__),
        listening=ListeningModel(**history_record["listening"]),
        insights=[InsightModel(**item) for item in insights],
        feedback=MentorFeedbackModel(**feedback),
        emotion=EmotionModel(**emotion_result),
        coach_message=coach_message,
        coach_actions=coach_actions,
    )
