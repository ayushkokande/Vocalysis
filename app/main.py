"""Streamlit entrypoint that ties together the Vocalysis agents."""
from __future__ import annotations

import io
from typing import Dict, List

import streamlit as st

from . import constants, emotion, interpreter, listener, mentor, memory, utils, visualizer


def _init_session() -> None:
    if "listener" not in st.session_state:
        st.session_state.listener = listener.ListenerAgent()
    if "interpreter" not in st.session_state:
        st.session_state.interpreter = interpreter.InterpreterAgent()
    if "mentor" not in st.session_state:
        st.session_state.mentor = mentor.MentorAgent()
    if "emotion" not in st.session_state:
        st.session_state.emotion = emotion.EmotionAgent()
    if "memory" not in st.session_state:
        st.session_state.memory = memory.MemoryStore()
    if "history" not in st.session_state:
        st.session_state.history = st.session_state.memory.get_recent()


def _analyse_audio(raw_audio: bytes, filename: str, goal: constants.PracticeGoal) -> Dict:
    waveform, sample_rate = utils.parse_audio(io.BytesIO(raw_audio))
    listener_agent: listener.ListenerAgent = st.session_state.listener
    interpreter_agent: interpreter.InterpreterAgent = st.session_state.interpreter
    mentor_agent: mentor.MentorAgent = st.session_state.mentor
    emotion_agent: emotion.EmotionAgent = st.session_state.emotion

    listening = listener_agent.analyse(waveform, sample_rate)
    insights = interpreter_agent.interpret(listening.features, goal)
    emotion_result = emotion_agent.infer(listening.features)
    if emotion_result:
        insights.append(
            {
                "trait": constants.VocalTrait.EMOTIONAL_IMPACT.value,
                "status": emotion_result.get("primary", ""),
                "detail": emotion_result.get("explanation", ""),
            }
        )
    feedback = mentor_agent.craft_feedback(insights, goal, emotion_result)

    session_id = utils.generate_session_id()
    duration = utils.estimate_duration(waveform, sample_rate)
    meta = utils.SessionMeta.create(session_id, filename, duration, goal.value)
    utils.save_audio(session_id, filename, raw_audio)
    st.session_state.memory.add(
        {
            "session": meta.__dict__,
            "features": listening.features,
            "insights": insights,
            "feedback": feedback,
            "emotion": emotion_result,
        }
    )
    st.session_state.history = st.session_state.memory.get_recent()

    return {
        "meta": meta,
        "listening": listening,
        "insights": insights,
        "feedback": feedback,
        "emotion": emotion_result,
    }


def _sidebar_controls() -> Dict:
    with st.sidebar:
        st.header("Session Controls")
        goal = st.selectbox(
            "Practice focus",
            options=list(constants.PracticeGoal),
            format_func=lambda option: option.value,
        )
        uploaded = st.file_uploader("Upload a vocal take", type=["wav", "mp3", "m4a", "ogg"])
        st.markdown(
            "Need material? Record a clip locally and upload, or drop in a rehearsal take."
        )
        st.divider()
        st.caption("Recent sessions")
        history = st.session_state.history
        for entry in history[:3]:
            meta = entry.get("session", {})
            st.text(f"{meta.get('session_id', '--')} · {meta.get('goal', '')}")
        return {"goal": goal, "uploaded": uploaded}


def _render_results(result: Dict) -> None:
    meta: utils.SessionMeta = result["meta"]
    listening: listener.ListenerResult = result["listening"]
    insights: List[Dict[str, str]] = result["insights"]
    feedback: Dict = result["feedback"]
    emotion_result: Dict | None = result.get("emotion")

    st.success(
        f"Session {meta.session_id} analysed — duration {utils.format_seconds(meta.duration_seconds)}"
    )

    col_pitch, col_energy = st.columns(2)
    with col_pitch:
        st.plotly_chart(visualizer.pitch_trace(listening), use_container_width=True)
    with col_energy:
        st.plotly_chart(visualizer.energy_trace(listening), use_container_width=True)

    st.subheader("Feature Snapshot")
    st.dataframe({"metric": list(listening.features.keys()), "value": list(listening.features.values())})

    st.subheader("Coach Insights")
    for item in insights:
        st.write(f"**{item['trait']}** — {item['status']}")
        st.caption(item["detail"])

    st.subheader("Mentor Playbook")
    st.write(f"**Headline:** {feedback['headline']}")
    st.markdown("\n".join(f"- {step}" for step in feedback["actions"]))
    st.info(feedback["encouragement"])

    if emotion_result:
        st.subheader("Emotional Tone")
        st.write(
            f"**Primary mood:** {emotion_result.get('primary', '--')} (intensity {emotion_result.get('intensity', 0.0)})"
        )
        st.caption(emotion_result.get("explanation", ""))

    st.subheader("Polarity Radar")
    st.plotly_chart(visualizer.feature_radar(listening.features), use_container_width=True)


def main() -> None:
    st.set_page_config(page_title=constants.APP_TITLE, layout="wide")
    st.title(constants.APP_TITLE)
    st.caption("Analyse, interpret, and coach vocal takes with a multi-agent workflow.")

    _init_session()
    controls = _sidebar_controls()

    uploaded = controls["uploaded"]
    goal = controls["goal"]

    placeholder = st.empty()
    if uploaded is not None:
        raw_audio = uploaded.getvalue()
        placeholder.audio(raw_audio, format=uploaded.type)
        if st.button("Analyse take", type="primary"):
            with st.spinner("Listening to your performance..."):
                try:
                    result = _analyse_audio(raw_audio, uploaded.name, goal)
                except Exception as exc:  # pragma: no cover - UI fallback
                    st.error(f"Could not analyse audio: {exc}")
                else:
                    _render_results(result)
    else:
        st.info("Upload a vocal take on the left to begin analysis.")

    st.divider()
    st.write(
        "Tip: pair this scaffold with Whisper or any pitch-tracking model for richer insights."
    )


if __name__ == "__main__":
    main()
