"""Mentor agent: turns analysed insights into coaching feedback."""
from __future__ import annotations

from typing import Dict, List

from . import constants


class MentorAgent:
    """Pedagogical layer that suggests actionable next steps."""

    def craft_feedback(
        self,
        insights: List[Dict[str, str]],
        goal: constants.PracticeGoal,
        emotion: Dict[str, str] | None = None,
    ) -> Dict[str, List[str] | str]:
        if not insights:
            return {
                "headline": "No analysis available",
                "actions": ["Upload or record a take to unlock feedback."],
                "encouragement": "Every take is progress—let's get a sample recorded!",
            }

        headline_parts = []
        actions: List[str] = []
        action_triggers = {
            "needs attention",
            "flat",
            "inconsistent",
            "wandering",
            "wide",
            "leaky",
            "diffuse",
            "blended",
            "shallow",
            "straight tone",
            "hazy",
        }
        for insight in insights:
            trait = insight.get("trait", "Trait")
            status = insight.get("status", "Unknown")
            detail = insight.get("detail", "")
            headline_parts.append(f"{trait}: {status}")
            if status.lower() in action_triggers:
                actions.append(self._translate_to_action(trait, status, goal))
            if detail:
                actions.append(detail)

        if emotion:
            tone = emotion.get("primary")
            narration = emotion.get("explanation")
            if tone:
                headline_parts.insert(0, f"Emotional tone: {tone}")
            if narration:
                actions.append(narration)

        actions = self._dedupe(actions)
        encouragement = self._goal_affirmation(goal)
        return {
            "headline": " · ".join(headline_parts[:3]),
            "actions": actions,
            "encouragement": encouragement,
        }

    def _translate_to_action(self, trait: str, status: str, goal: constants.PracticeGoal) -> str:
        status_key = status.lower()
        library: Dict[str, Dict[str, str] | str] = {
            constants.VocalTrait.PITCH_CONTROL.value: {
                "default": "Slide between neighbouring notes with a tuner drone, sustaining clean airflow.",
            },
            constants.VocalTrait.DYNAMICS.value: {
                "default": "Map a phrase from pianissimo to forte then back, noting breath pacing.",
            },
            constants.VocalTrait.TIMBRE_BALANCE.value: {
                "hazy": "Refine onset with firm breath; imagine a narrow straw to concentrate resonance.",
                "bright": "Blend in warmth by shaping taller vowels and relaxing the jaw.",
                "default": "Alternate bright and warm vowels to explore resonance placement.",
            },
            constants.VocalTrait.RHYTHMIC_STEADINESS.value: {
                "wandering": "Rehearse with a click at half-speed, tapping subdivisions before singing.",
                "default": "Clap the rhythm with a metronome, then vocalise on neutral syllables.",
            },
            constants.VocalTrait.PHRASE_SHAPING.value: {
                "default": "Mark phrase peaks on the score and breathe into each contour deliberately.",
            },
            constants.VocalTrait.VIBRATO_CONTROL.value: {
                "wide": "Stabilise airflow: sustain notes against a wall while monitoring vibrato width.",
                "shallow": "Add spin by pulsing gentle belly breaths on long notes.",
                "straight tone": "Experiment with pulsing airflow at 5–6 Hz to awaken vibrato.",
                "default": "Record sustained notes at various dynamics to monitor vibrato consistency.",
            },
            constants.VocalTrait.BREATH_MANAGEMENT.value: {
                "leaky": "Practice hiss-sustain exercises to build back pressure before singing text.",
                "default": "Align ribs and hips, then inhale silently for a count of four before phrasing.",
            },
            constants.VocalTrait.TONE_CLARITY.value: {
                "diffuse": "Lift the soft palate and energise consonants with a straw phonation warm-up.",
                "default": "Alternate hum-to-open vowels to retain resonance focus.",
            },
            constants.VocalTrait.ARTICULATION.value: {
                "blended": "Over-articulate tongue twisters on a metronome, then transfer to the melody.",
                "default": "Practise crescendo on consonant clusters to keep diction energised.",
            },
            constants.VocalTrait.EMOTIONAL_IMPACT.value: {
                "default": "Storyboard the lyric and assign emotional colours to each phrase before singing.",
            },
        }
        trait_library = library.get(trait)
        if isinstance(trait_library, dict):
            return trait_library.get(status_key, trait_library.get("default", constants.COACHING_TIPS[goal]))
        fallback = constants.COACHING_TIPS[goal]
        if isinstance(trait_library, str):
            return trait_library
        return fallback

    def _goal_affirmation(self, goal: constants.PracticeGoal) -> str:
        messages = {
            constants.PracticeGoal.INTONATION: "Micro-adjustments add up—stay patient and listen deeply.",
            constants.PracticeGoal.BREATH: "Open ribs and steady airflow unlock vocal freedom.",
            constants.PracticeGoal.RANGE: "Gentle daily sirens expand range safely.",
            constants.PracticeGoal.EXPRESSIVITY: "You already have stories to tell—let dynamics carry them.",
            constants.PracticeGoal.CONFIDENCE: "Anchor to the lyric and breathe; confidence follows intention.",
        }
        return messages.get(goal, "Keep experimenting and logging your takes!")

    def _dedupe(self, items: List[str]) -> List[str]:
        seen = set()
        deduped: List[str] = []
        for item in items:
            key = item.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        return deduped
