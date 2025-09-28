"""Interpreter agent: maps low-level descriptors into voice coaching insights."""
from __future__ import annotations

from typing import Dict, List, Optional

from . import constants


class InterpreterAgent:
    """Rule-based heuristics that approximate semantic vocal traits."""

    def __init__(self) -> None:
        self.pitch_secure_threshold = 25.0
        self.pitch_confidence_threshold = 0.6
        self.dynamic_bloom_threshold = 0.08
        self.timbre_brightness_threshold = 2800.0
        self.rhythm_tolerance_bpm = 8.0
        self.energy_variability_threshold = 0.02
        self.vibrato_rate_bounds = (4.0, 8.0)
        self.vibrato_depth_bounds = (10.0, 80.0)
        self.voiced_support_threshold = 0.62
        self.flatness_warm_threshold = 0.35
        self.articulation_zcr_threshold = 0.075

    def interpret(
        self,
        features: Dict[str, float],
        goal: constants.PracticeGoal,
        focus_traits: Optional[List[str]] = None,
    ) -> List[Dict[str, str]]:
        if not features:
            return []

        insights = [
            self._pitch_control(features),
            self._dynamics(features),
            self._timbre_balance(features),
            self._rhythmic_steadiness(features),
            self._phrase_shaping(features),
            self._vibrato_control(features),
            self._breath_management(features),
            self._tone_clarity(features),
            self._articulation(features),
        ]

        insights = [insight for insight in insights if insight]
        insights.append(
            {
                "trait": "Goal Alignment",
                "status": goal.value,
                "detail": constants.COACHING_TIPS[goal],
            }
        )

        if focus_traits:
            focus_set = {trait.lower() for trait in focus_traits}
            filtered = [
                insight
                for insight in insights
                if insight["trait"].lower() in focus_set or insight["trait"] == "Goal Alignment"
            ]
            if filtered:
                insights = filtered
        return insights

    def _pitch_control(self, features: Dict[str, float]) -> Dict[str, str]:
        spread = features.get("pitch_stability", 0.0)
        confidence = features.get("pitch_confidence", 0.0)
        status = "Secure"
        detail = "Pitch centre held steady with reliable intonation."
        if spread > self.pitch_secure_threshold or confidence < self.pitch_confidence_threshold:
            status = "Needs attention"
            detail = "Vocal pitch wobbled beyond the comfort zone; aim for centred support on sustained notes."
        return {
            "trait": constants.VocalTrait.PITCH_CONTROL.value,
            "status": status,
            "detail": detail,
        }

    def _dynamics(self, features: Dict[str, float]) -> Dict[str, str]:
        dynamic_range = features.get("dynamic_range", 0.0)
        variability = features.get("energy_variability", 0.0)
        expressive = dynamic_range >= self.dynamic_bloom_threshold and variability >= self.energy_variability_threshold
        if expressive:
            status = "Expressive"
            detail = "Dynamics bloom across the phrase—nice energy contours."
        else:
            status = "Flat"
            detail = "Dynamic contrast is limited; plan intentional swells and releases."
        return {
            "trait": constants.VocalTrait.DYNAMICS.value,
            "status": status,
            "detail": detail,
        }

    def _timbre_balance(self, features: Dict[str, float]) -> Dict[str, str]:
        centroid = features.get("spectral_centroid", 0.0)
        bandwidth = features.get("spectral_bandwidth", 0.0)
        harmonic_ratio = features.get("harmonic_ratio", 0.0)
        if centroid > self.timbre_brightness_threshold and bandwidth > 2200.0:
            status = "Bright"
            detail = "Forward, brilliant resonance dominates; relax tongue and drop the larynx for warmth."
        elif harmonic_ratio < 0.45:
            status = "Hazy"
            detail = "Harmonic content is masked by breath or noise—focus on clear, supported onset."
        else:
            status = "Balanced"
            detail = "Resonance tilt lands in a healthy brightness/warmth window."
        return {
            "trait": constants.VocalTrait.TIMBRE_BALANCE.value,
            "status": status,
            "detail": detail,
        }

    def _rhythmic_steadiness(self, features: Dict[str, float]) -> Dict[str, str]:
        tempo = features.get("tempo_bpm", 0.0)
        percussive = features.get("percussive_ratio", 0.0)
        deviation = abs(tempo - 90.0)
        if tempo == 0.0:
            status = "Free"
            detail = "Pulse not detected—likely rubato delivery; add a click track to firm up when needed."
        elif deviation <= self.rhythm_tolerance_bpm and percussive >= 0.25:
            status = "Locked"
            detail = "Consistent tempo reference with articulate rhythmic support."
        else:
            status = "Wandering"
            detail = "Tempo fluctuates; rehearse with steady subdivision to anchor the groove."
        return {
            "trait": constants.VocalTrait.RHYTHMIC_STEADINESS.value,
            "status": status,
            "detail": detail,
        }

    def _phrase_shaping(self, features: Dict[str, float]) -> Dict[str, str]:
        variability = features.get("energy_variability", 0.0)
        voiced_ratio = features.get("pitch_voiced_ratio", 0.0)
        if variability > self.energy_variability_threshold and voiced_ratio >= 0.6:
            status = "Contoured"
            detail = "Phrase arc shows breath and energy flow with intentional release points."
        else:
            status = "Even"
            detail = "Phrase energy is uniform; sculpt crescendos and cadences for drama."
        return {
            "trait": constants.VocalTrait.PHRASE_SHAPING.value,
            "status": status,
            "detail": detail,
        }

    def _vibrato_control(self, features: Dict[str, float]) -> Dict[str, str]:
        rate = features.get("vibrato_rate", 0.0)
        depth = features.get("vibrato_depth", 0.0)
        if rate == 0.0 or depth == 0.0:
            status = "Straight tone"
            detail = "Sustains are mostly straight—use gentle oscillations to add shimmer when stylistically desired."
        elif self.vibrato_rate_bounds[0] <= rate <= self.vibrato_rate_bounds[1] and self.vibrato_depth_bounds[0] <= depth <= self.vibrato_depth_bounds[1]:
            status = "Balanced"
            detail = "Vibrato falls in a classic belt of rate/depth—musical and controlled."
        elif rate > self.vibrato_rate_bounds[1] or depth > self.vibrato_depth_bounds[1]:
            status = "Wide"
            detail = "Vibrato gets dramatic; stabilise airflow and narrow oscillations for clarity."
        else:
            status = "Shallow"
            detail = "Oscillation is light; encourage even airflow and relax the larynx to open it up."
        return {
            "trait": constants.VocalTrait.VIBRATO_CONTROL.value,
            "status": status,
            "detail": detail,
        }

    def _breath_management(self, features: Dict[str, float]) -> Dict[str, str]:
        voiced_ratio = features.get("pitch_voiced_ratio", 0.0)
        mean_energy = features.get("mean_energy", 0.0)
        if voiced_ratio >= self.voiced_support_threshold and mean_energy >= 0.35:
            status = "Supported"
            detail = "Consistent voicing suggests buoyant breath support."
        else:
            status = "Leaky"
            detail = "Frequent unvoiced gaps or low energy imply breath leaks—reset posture and engage the diaphragm."
        return {
            "trait": constants.VocalTrait.BREATH_MANAGEMENT.value,
            "status": status,
            "detail": detail,
        }

    def _tone_clarity(self, features: Dict[str, float]) -> Dict[str, str]:
        flatness = features.get("spectral_flatness", 0.0)
        mfcc1 = features.get("mfcc_1", 0.0)
        if flatness <= self.flatness_warm_threshold and mfcc1 > -200.0:
            status = "Focused"
            detail = "Tone carries harmonic focus with minimal noise."
        else:
            status = "Diffuse"
            detail = "Extra noise bleeding into tone—lift the soft palate and energise consonants."
        return {
            "trait": constants.VocalTrait.TONE_CLARITY.value,
            "status": status,
            "detail": detail,
        }

    def _articulation(self, features: Dict[str, float]) -> Dict[str, str]:
        zcr = features.get("zero_crossing_rate", 0.0)
        percussive = features.get("percussive_ratio", 0.0)
        if zcr >= self.articulation_zcr_threshold and percussive >= 0.2:
            status = "Crisp"
            detail = "Consonant clarity helps rhythmic impression pop."
        else:
            status = "Blended"
            detail = "Articulation blends into legato—try over-enunciating plosives and fricatives in rehearsal."
        return {
            "trait": constants.VocalTrait.ARTICULATION.value,
            "status": status,
            "detail": detail,
        }
