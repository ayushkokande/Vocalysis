"""Listener agent: extracts acoustic features from an audio take."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Tuple

import numpy as np

from . import constants
from .utils import safe_float

try:
    import librosa
except Exception:  # pragma: no cover
    librosa = None


@dataclass
class ListenerResult:
    """Structured view of acoustic measurements."""

    features: Dict[str, float]
    pitch_contour: np.ndarray
    pitch_times: np.ndarray
    pitch_voiced_flags: np.ndarray
    pitch_voiced_probabilities: np.ndarray
    rms_envelope: np.ndarray
    rms_times: np.ndarray


class ListenerAgent:
    """Computes lightweight audio descriptors for downstream agents."""

    def __init__(self, sample_rate: int = constants.DEFAULT_SAMPLE_RATE) -> None:
        self.sample_rate = sample_rate

    def analyse(self, samples: np.ndarray, sample_rate: int | None = None) -> ListenerResult:
        sr = sample_rate or self.sample_rate
        contour, times, voiced_flags, voiced_probabilities = self._extract_pitch_contour(
            samples, sr
        )
        rms = self._rms_envelope(samples)
        tempo = self._estimate_tempo(samples, sr)
        centroid = self._spectral_centroid(samples, sr)
        rolloff = self._spectral_rolloff(samples, sr)
        bandwidth = self._spectral_bandwidth(samples, sr)
        flatness = self._spectral_flatness(samples, sr)
        contrast = self._spectral_contrast(samples, sr)
        zcr = self._zero_crossing_rate(samples)
        harmonic_ratio, percussive_ratio = self._harmonic_percussive_balance(samples)
        mfcc_stats = self._mfcc_descriptors(samples, sr)

        vibrato_rate, vibrato_depth = self._vibrato_metrics(contour, times)

        voiced_ratio = safe_float(float(np.mean(voiced_flags))) if voiced_flags.size else 0.0
        pitch_confidence = (
            safe_float(float(np.nanmean(voiced_probabilities)))
            if voiced_probabilities.size
            else 0.0
        )

        features = {
            "mean_pitch": safe_float(np.nanmean(contour)) if contour.size else 0.0,
            "pitch_stability": safe_float(np.nanstd(contour)) if contour.size else 0.0,
            "mean_energy": safe_float(float(np.mean(rms))),
            "energy_variability": safe_float(float(np.std(rms))),
            "tempo_bpm": safe_float(float(tempo)),
            "spectral_centroid": safe_float(float(np.mean(centroid))) if centroid.size else 0.0,
            "spectral_rolloff": safe_float(float(np.mean(rolloff))) if rolloff.size else 0.0,
            "dynamic_range": safe_float(float(np.max(rms) - np.min(rms))),
            "spectral_bandwidth": safe_float(float(np.mean(bandwidth))) if bandwidth.size else 0.0,
            "spectral_flatness": safe_float(float(np.mean(flatness))) if flatness.size else 0.0,
            "spectral_contrast": safe_float(float(np.mean(contrast))) if contrast.size else 0.0,
            "zero_crossing_rate": safe_float(float(np.mean(zcr))) if zcr.size else 0.0,
            "harmonic_ratio": harmonic_ratio,
            "percussive_ratio": percussive_ratio,
            "pitch_voiced_ratio": voiced_ratio,
            "pitch_confidence": pitch_confidence,
            "vibrato_rate": vibrato_rate,
            "vibrato_depth": vibrato_depth,
        }

        for index, value in enumerate(mfcc_stats, start=1):
            features[f"mfcc_{index}"] = value

        rms_times = self._times_like(rms.shape[-1], sample_rate=sr)
        return ListenerResult(
            features=features,
            pitch_contour=contour,
            pitch_times=times,
            pitch_voiced_flags=voiced_flags,
            pitch_voiced_probabilities=voiced_probabilities,
            rms_envelope=rms,
            rms_times=rms_times,
        )

    def _rms_envelope(self, samples: np.ndarray) -> np.ndarray:
        if librosa is None:
            return np.abs(samples)
        try:
            rms = librosa.feature.rms(
                y=samples,
                frame_length=constants.DEFAULT_FRAME_SIZE,
                hop_length=constants.DEFAULT_HOP_LENGTH,
            )[0]
            return rms.astype(np.float32)
        except Exception:
            return np.abs(samples)

    def _extract_pitch_contour(
        self, samples: np.ndarray, sample_rate: int
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        if librosa is None:
            empty = np.array([], dtype=np.float32)
            return empty, empty, empty, empty

        try:
            fmin, fmax = 80.0, 1200.0
            contour, voiced_flags, voiced_probabilities = librosa.pyin(
                samples,
                fmin=fmin,
                fmax=fmax,
                sr=sample_rate,
                frame_length=constants.DEFAULT_FRAME_SIZE,
                hop_length=constants.DEFAULT_HOP_LENGTH,
                fill_na=np.nan,
            )
            contour = contour.astype(np.float32)
            voiced_flags = voiced_flags.astype(np.float32)
            voiced_probabilities = voiced_probabilities.astype(np.float32)
            times = librosa.times_like(
                contour, sr=sample_rate, hop_length=constants.DEFAULT_HOP_LENGTH
            ).astype(np.float32)
        except Exception:
            contour = np.array([], dtype=np.float32)
            times = np.array([], dtype=np.float32)
            voiced_flags = np.array([], dtype=np.float32)
            voiced_probabilities = np.array([], dtype=np.float32)
        return contour, times, voiced_flags, voiced_probabilities

    def _estimate_tempo(self, samples: np.ndarray, sample_rate: int) -> float:
        if librosa is None:
            return 0.0
        try:
            tempo, _ = librosa.beat.beat_track(y=samples, sr=sample_rate)
            return float(tempo)
        except Exception:
            return 0.0

    def _spectral_centroid(self, samples: np.ndarray, sample_rate: int) -> np.ndarray:
        if librosa is None:
            return np.array([])
        try:
            centroid = librosa.feature.spectral_centroid(
                y=samples,
                sr=sample_rate,
                n_fft=constants.DEFAULT_FRAME_SIZE,
                hop_length=constants.DEFAULT_HOP_LENGTH,
            )
            return centroid[0]
        except Exception:
            return np.array([])

    def _spectral_rolloff(self, samples: np.ndarray, sample_rate: int) -> np.ndarray:
        if librosa is None:
            return np.array([])
        try:
            rolloff = librosa.feature.spectral_rolloff(
                y=samples,
                sr=sample_rate,
                n_fft=constants.DEFAULT_FRAME_SIZE,
                hop_length=constants.DEFAULT_HOP_LENGTH,
            )
            return rolloff[0]
        except Exception:
            return np.array([])

    def _spectral_bandwidth(self, samples: np.ndarray, sample_rate: int) -> np.ndarray:
        if librosa is None:
            return np.array([])
        try:
            bandwidth = librosa.feature.spectral_bandwidth(
                y=samples,
                sr=sample_rate,
                n_fft=constants.DEFAULT_FRAME_SIZE,
                hop_length=constants.DEFAULT_HOP_LENGTH,
            )
            return bandwidth[0]
        except Exception:
            return np.array([])

    def _spectral_flatness(self, samples: np.ndarray, sample_rate: int) -> np.ndarray:
        if librosa is None:
            return np.array([])
        try:
            flatness = librosa.feature.spectral_flatness(
                y=samples,
                n_fft=constants.DEFAULT_FRAME_SIZE,
                hop_length=constants.DEFAULT_HOP_LENGTH,
            )
            return flatness[0]
        except Exception:
            return np.array([])

    def _spectral_contrast(self, samples: np.ndarray, sample_rate: int) -> np.ndarray:
        if librosa is None:
            return np.array([])
        try:
            contrast = librosa.feature.spectral_contrast(
                y=samples,
                sr=sample_rate,
                n_fft=constants.DEFAULT_FRAME_SIZE,
                hop_length=constants.DEFAULT_HOP_LENGTH,
            )
            return np.mean(contrast, axis=0)
        except Exception:
            return np.array([])

    def _zero_crossing_rate(self, samples: np.ndarray) -> np.ndarray:
        if librosa is None:
            return np.array([])
        try:
            zcr = librosa.feature.zero_crossing_rate(
                y=samples,
                frame_length=constants.DEFAULT_FRAME_SIZE,
                hop_length=constants.DEFAULT_HOP_LENGTH,
            )
            return zcr[0]
        except Exception:
            return np.array([])

    def _harmonic_percussive_balance(self, samples: np.ndarray) -> Tuple[float, float]:
        if librosa is None:
            return 0.0, 0.0
        try:
            harmonic = librosa.effects.harmonic(samples)
            percussive = librosa.effects.percussive(samples)
            harmonic_energy = float(np.mean(np.abs(harmonic)))
            percussive_energy = float(np.mean(np.abs(percussive)))
            total = harmonic_energy + percussive_energy + 1e-8
            return safe_float(harmonic_energy / total), safe_float(percussive_energy / total)
        except Exception:
            return 0.0, 0.0

    def _mfcc_descriptors(self, samples: np.ndarray, sample_rate: int, count: int = 5) -> np.ndarray:
        if librosa is None:
            return np.zeros(count, dtype=np.float32)
        try:
            mfcc = librosa.feature.mfcc(
                y=samples,
                sr=sample_rate,
                n_mfcc=count,
                hop_length=constants.DEFAULT_HOP_LENGTH,
            )
            return np.mean(mfcc, axis=1).astype(np.float32)
        except Exception:
            return np.zeros(count, dtype=np.float32)

    def _vibrato_metrics(self, contour: np.ndarray, times: np.ndarray) -> Tuple[float, float]:
        if contour.size == 0 or times.size == 0:
            return 0.0, 0.0
        mask = np.isfinite(contour)
        if not np.any(mask):
            return 0.0, 0.0
        contour_clean = contour[mask]
        times_clean = times[mask]
        if contour_clean.size < 4:
            return 0.0, 0.0
        detrended = contour_clean - np.nanmean(contour_clean)
        duration = float(times_clean[-1] - times_clean[0])
        crossings = np.where(np.diff(np.signbit(detrended)))[0]
        vibrato_rate = 0.0
        if duration > 0 and crossings.size > 0:
            vibrato_rate = safe_float((crossings.size / 2) / duration)
        vibrato_depth = safe_float(float(np.percentile(np.abs(detrended), 90)))
        return vibrato_rate, vibrato_depth

    def _times_like(self, frame_count: int, sample_rate: int) -> np.ndarray:
        if frame_count == 0:
            return np.array([], dtype=np.float32)
        hop = constants.DEFAULT_HOP_LENGTH
        times = np.arange(frame_count, dtype=np.float32) * hop / float(sample_rate)
        return times
