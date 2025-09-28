"""Emotion heuristics inferred from acoustic descriptors."""
from __future__ import annotations

from typing import Dict

from . import constants


class EmotionAgent:
    """Lightweight mapper that infers a vocal emotional tone from features."""

    def __init__(self) -> None:
        self._emotion_labels = [
            constants.VocalEmotion.RADIANT,
            constants.VocalEmotion.ENERGISED,
            constants.VocalEmotion.SOOTHING,
            constants.VocalEmotion.INTROSPECTIVE,
            constants.VocalEmotion.DRAMATIC,
        ]

    def infer(self, features: Dict[str, float]) -> Dict[str, object]:
        if not features:
            return {
                "primary": constants.VocalEmotion.SOOTHING.value,
                "scores": {label.value: 0.0 for label in self._emotion_labels},
                "intensity": 0.0,
                "explanation": "No audio descriptors available to infer emotion.",
            }

        energy_score = self._scale(features.get("mean_energy", 0.0), 0.12, 0.85)
        dynamic_score = self._scale(features.get("dynamic_range", 0.0), 0.03, 0.25)
        brightness_score = self._scale(features.get("spectral_centroid", 0.0), 1400.0, 3600.0)
        warmth_score = 1.0 - brightness_score
        tempo_score = self._scale(features.get("tempo_bpm", 0.0), 55.0, 150.0)
        vibrato_score = self._scale(features.get("vibrato_depth", 0.0), 8.0, 90.0)
        articulation_score = self._scale(features.get("percussive_ratio", 0.0), 0.12, 0.6)
        stability_score = 1.0 - self._scale(features.get("pitch_stability", 0.0), 18.0, 60.0)
        confidence = self._scale(features.get("pitch_confidence", 0.0), 0.4, 0.95)

        scores = {
            constants.VocalEmotion.RADIANT: self._blend(
                brightness_score, energy_score, dynamic_score, weights=(0.35, 0.35, 0.3)
            ),
            constants.VocalEmotion.ENERGISED: self._blend(
                energy_score, tempo_score, articulation_score, weights=(0.45, 0.35, 0.2)
            ),
            constants.VocalEmotion.SOOTHING: self._blend(
                warmth_score, stability_score, 1.0 - tempo_score, weights=(0.5, 0.3, 0.2)
            ),
            constants.VocalEmotion.INTROSPECTIVE: self._blend(
                warmth_score, vibrato_score, 1.0 - dynamic_score, weights=(0.4, 0.3, 0.3)
            ),
            constants.VocalEmotion.DRAMATIC: self._blend(
                dynamic_score, vibrato_score, 1.0 - stability_score, weights=(0.4, 0.35, 0.25)
            ),
        }

        primary_emotion = max(scores.items(), key=lambda item: item[1])[0]
        intensity = self._blend(energy_score, dynamic_score, confidence, weights=(0.4, 0.35, 0.25))
        explanation = self._build_explanation(
            primary_emotion,
            brightness_score,
            energy_score,
            dynamic_score,
            tempo_score,
            vibrato_score,
        )

        return {
            "primary": primary_emotion.value,
            "scores": {label.value: round(float(scores[label]), 3) for label in self._emotion_labels},
            "intensity": round(float(intensity), 3),
            "explanation": explanation,
        }

    @staticmethod
    def _scale(value: float, lower: float, upper: float) -> float:
        if upper <= lower:
            return 0.0
        normalised = (value - lower) / (upper - lower)
        return max(0.0, min(1.0, float(normalised)))

    @staticmethod
    def _blend(*components: float, weights: tuple[float, ...] | None = None) -> float:
        values = components
        if weights is None:
            weights = tuple(1.0 for _ in values)
        total_weight = sum(weights)
        if total_weight == 0:
            return 0.0
        score = sum(value * weight for value, weight in zip(values, weights)) / total_weight
        return max(0.0, min(1.0, float(score)))

    def _build_explanation(
        self,
        emotion: constants.VocalEmotion,
        brightness_score: float,
        energy_score: float,
        dynamic_score: float,
        tempo_score: float,
        vibrato_score: float,
    ) -> str:
        tone = "bright" if brightness_score >= 0.55 else "warm"
        energy = "energised" if energy_score >= 0.6 else "restrained"
        dynamics = "dramatic swells" if dynamic_score >= 0.55 else "gentle contours"
        tempo = "driving pulse" if tempo_score >= 0.6 else "relaxed pacing"
        vibrato = "noticeable vibrato shimmer" if vibrato_score >= 0.5 else "subtle vibrato"
        return (
            f"Timbre leans {tone}, delivery feels {energy}, with {dynamics} and a {tempo}. "
            f"Combined with {vibrato}, the performance reads as {emotion.value.lower()}."
        )
