"""OpenAI-powered coaching message generation."""
from __future__ import annotations

import os
import json
from typing import Dict, List, Optional, Tuple

from openai import OpenAI

from . import constants

_CLIENT: Optional[OpenAI] = None


def _get_client() -> Optional[OpenAI]:
    global _CLIENT
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    if _CLIENT is None:
        _CLIENT = OpenAI(api_key=api_key)
    return _CLIENT


def build_coach_message(
    features: Dict[str, float],
    insights: List[Dict[str, str]],
    feedback: Dict[str, List[str] | str],
    goal: constants.PracticeGoal,
) -> Optional[Tuple[str, List[str], str]]:
    client = _get_client()
    if client is None:
        return None

    feature_lines = []
    for key, value in features.items():
        feature_lines.append(f"- {key}: {value:.4f}")
    insight_lines = []
    for item in insights:
        trait = item.get("trait", "Trait")
        status = item.get("status", "")
        detail = item.get("detail")
        if detail:
            insight_lines.append(f"- {trait}: {status} — {detail}")
        else:
            insight_lines.append(f"- {trait}: {status}")

    prompt = (
        "You are a concise vocal coach."
        " Use the vocal metrics and insights to give the singer:"
        " (1) a two-sentence summary, (2) a list of 2-3 actionable drills,"
        " (3) one sentence of encouragement."
        " Do not repeat raw numbers—describe them plainly."
        " Actions must be short, concrete, and start with a verb."
        "\n\n"
        f"Goal: {goal.value}\n"
        f"Headline feedback: {feedback.get('headline', 'None')}\n"
        "Metrics:\n"
        + "\n".join(feature_lines)
        + "\nInsights:\n"
        + ("\n".join(insight_lines) or "- None")
    )

    schema = {
        "name": "coach_response",
        "schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "maxLength": 500},
                "actions": {
                    "type": "array",
                    "items": {"type": "string", "maxLength": 200},
                    "minItems": 2,
                    "maxItems": 3,
                },
                "encouragement": {"type": "string", "maxLength": 200},
            },
            "required": ["summary", "actions", "encouragement"],
        },
    }

    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            input=prompt,
            max_output_tokens=350,
            temperature=0.4,
            response_format={"type": "json_schema", "json_schema": schema},
        )
    except Exception:
        return None

    content = None
    try:
        if hasattr(response, "output") and response.output:
            block = response.output[0]
            if block.content and block.content[0].type == "output_text":
                content = block.content[0].text
        if content is None and hasattr(response, "output_text"):
            content = response.output_text
        data = json.loads(content) if content else None
    except Exception:
        data = None

    if not data:
        return None

    summary = data.get("summary", "").strip()
    actions = [str(item).strip() for item in data.get("actions", []) if str(item).strip()]
    encouragement = data.get("encouragement", "").strip()
    if not summary and not actions:
        return None
    return summary, actions, encouragement
