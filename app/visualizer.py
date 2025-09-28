"""Plotly visualisations for the Vocalysis UI."""
from __future__ import annotations

from typing import Dict

import numpy as np
import plotly.graph_objects as go

from . import constants
from .listener import ListenerResult


def _apply_theme(fig: go.Figure) -> go.Figure:
    theme = constants.PLOTLY_THEMES
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor=theme["background"],
        plot_bgcolor=theme["background"],
        font_color=theme["text"],
        margin=dict(l=40, r=30, t=50, b=30),
        height=300,
    )
    return fig


def pitch_trace(result: ListenerResult) -> go.Figure:
    fig = go.Figure()
    if result.pitch_contour.size:
        fig.add_trace(
            go.Scatter(
                x=result.pitch_times,
                y=result.pitch_contour,
                mode="lines",
                name="Pitch",
                line=dict(color=constants.PLOTLY_THEMES["accent"], width=2),
            )
        )
        fig.update_yaxes(title="Frequency (Hz)")
    else:
        fig.add_annotation(
            text="Pitch contour unavailable",
            showarrow=False,
            font=dict(color=constants.PLOTLY_THEMES["secondary"]),
            x=0.5,
            y=0.5,
            xref="paper",
            yref="paper",
        )
    fig.update_xaxes(title="Time (s)")
    return _apply_theme(fig)


def energy_trace(result: ListenerResult) -> go.Figure:
    fig = go.Figure()
    if result.rms_envelope.size:
        fig.add_trace(
            go.Scatter(
                x=result.rms_times,
                y=result.rms_envelope,
                fill="tozeroy",
                name="Energy",
                line=dict(color=constants.PLOTLY_THEMES["secondary"], width=1.5),
            )
        )
        fig.update_yaxes(title="RMS")
    else:
        fig.add_annotation(
            text="Energy plot unavailable",
            showarrow=False,
            font=dict(color=constants.PLOTLY_THEMES["secondary"]),
            x=0.5,
            y=0.5,
            xref="paper",
            yref="paper",
        )
    fig.update_xaxes(title="Time (s)")
    return _apply_theme(fig)


def feature_radar(features: Dict[str, float]) -> go.Figure:
    fig = go.Figure()
    if not features:
        fig.add_annotation(
            text="No features extracted",
            showarrow=False,
            font=dict(color=constants.PLOTLY_THEMES["secondary"]),
            x=0.5,
            y=0.5,
            xref="paper",
            yref="paper",
        )
        return _apply_theme(fig)

    labels = list(features.keys())
    values = [float(abs(features[label])) for label in labels]
    # close radar loop
    labels.append(labels[0])
    values.append(values[0])
    fig.add_trace(
        go.Scatterpolar(
            r=values,
            theta=labels,
            fill="toself",
            name="Descriptors",
            line=dict(color=constants.PLOTLY_THEMES["accent"]),
        )
    )
    fig.update_layout(polar=dict(radialaxis=dict(showticklabels=False, visible=True)))
    return _apply_theme(fig)
