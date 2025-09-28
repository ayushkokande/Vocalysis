import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts'
import { Play, Pause, RotateCcw, Mic, Upload, Loader2, FileAudio, CheckCircle2, X } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { useStudioData } from '../context/studio-data'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

const PRACTICE_GOALS = [
  { id: 'INTONATION', label: 'Intonation Accuracy', value: 'Intonation Accuracy' },
  { id: 'BREATH', label: 'Breath Support', value: 'Breath Support' },
  { id: 'RANGE', label: 'Range Expansion', value: 'Range Expansion' },
  { id: 'EXPRESSIVITY', label: 'Expressivity', value: 'Expressivity' },
  { id: 'CONFIDENCE', label: 'Performance Confidence', value: 'Performance Confidence' },
]

const TICK_INTERVAL = 80 // ~12.5 Hz
const MAX_POINTS = 200

const clamp01 = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const INSIGHT_DRILL_MAP = {
  'Pitch Control': 'Slow siren on straw phonation with tuner reference',
  'Dynamic Control': 'Crescendo/decrescendo swell over a sustained vowel',
  'Timbre Balance': 'Vowel shaping between bright “ee” and warm “ah”',
  'Rhythmic Steadiness': 'Metronome clapping followed by neutral syllable singing',
  'Phrase Shaping': 'Breath-planned phrase with mapped swell and release points',
  'Vibrato Control': 'Sustained note with timed vibrato pulses (5–6 Hz)',
  'Breath Management': 'Four-count inhale / eight-count hiss support drill',
  'Tone Clarity': 'Resonant hum into open vowel maintaining focus',
  'Articulation Precision': 'Metronome tongue-twister with exaggerated consonants',
  'Emotional Impact': 'Lyric storytelling pass naming colour and intent',
}

async function ensureWavFile(file) {
  if (!file) return null
  if (file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')) {
    return file
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    return file
  }
  try {
    const arrayBuffer = await file.arrayBuffer()
    const audioContext = new AudioContextClass()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
    const wavArrayBuffer = encodeWavBuffer(audioBuffer)
    await audioContext.close()
    const wavFile = new File([wavArrayBuffer], `${file.name.replace(/\.[^/.]+$/, '') || 'take'}.wav`, {
      type: 'audio/wav',
    })
    return wavFile
  } catch (err) {
    console.error('Failed to convert audio to WAV, falling back to original file.', err)
    return file
  }
}

function encodeWavBuffer(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate
  const channelData = []
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    channelData.push(audioBuffer.getChannelData(channel))
  }
  const length = audioBuffer.length
  const mono = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    let sum = 0
    for (let channel = 0; channel < channelData.length; channel += 1) {
      sum += channelData[channel][i] || 0
    }
    mono[i] = sum / channelData.length
  }

  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const buffer = new ArrayBuffer(44 + mono.length * bytesPerSample)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + mono.length * bytesPerSample, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)
  writeString(view, 36, 'data')
  view.setUint32(40, mono.length * bytesPerSample, true)

  floatTo16BitPCM(view, 44, mono)
  return buffer
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i += 1) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i += 1, offset += 2) {
    let sample = input[i]
    sample = Math.max(-1, Math.min(1, sample))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
}

function useLiveSeries(initialState, generator) {
  const [series, setSeries] = useState(initialState)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      setSeries((prev) => generator(prev))
    }, TICK_INTERVAL)
    return () => clearInterval(interval)
  }, [generator, running])

  const reset = () => setSeries(initialState)

  return { series, running, setRunning, reset }
}

function ControlButtons({ running, onPlay, onPause, onReset, disabled = false }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={running ? onPause : onPlay}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-accent transition hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={running ? 'Pause' : 'Play'}
        disabled={disabled}
      >
        {running ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent/40 text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Reset"
        disabled={disabled}
      >
        <RotateCcw size={18} />
      </button>
    </div>
  )
}

function StatsGrid({ items }) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm text-slate-200 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-white/5 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-300/70">{item.label}</dt>
          <dd className="mt-1 text-lg font-semibold text-white">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function AnalysisInputCard() {
  const { analysis, setAnalysis, analysisGoal, setAnalysisGoal } = useStudioData()
  const [goal, setGoal] = useState(analysisGoal ?? PRACTICE_GOALS[0].value)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [recording, setRecording] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream?.getTracks?.().forEach((track) => track.stop())
      }
    }
  }, [previewUrl])

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setSelectedFile(file)
      setStatus('Ready to analyse uploaded file.')
      setError('')
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recordedChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type })
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setSelectedFile(file)
        setStatus('Recording captured. Ready to analyse.')
      }
      mediaRecorderRef.current = { recorder, stream }
      recorder.start()
      setRecording(true)
      setStatus('Recording… speak naturally about your current exercise.')
      setError('')
    } catch (err) {
      setError('Microphone access denied. Please allow audio recording or upload a file instead.')
    }
  }

  const stopRecording = () => {
    const current = mediaRecorderRef.current
    if (!current) return
    if (current.recorder.state !== 'inactive') {
      current.recorder.stop()
    }
    current.stream.getTracks().forEach((track) => track.stop())
    mediaRecorderRef.current = null
    setRecording(false)
  }

  const submitAudio = async () => {
    if (!selectedFile) {
      setError('Please upload or record a short vocal take first.')
      return
    }
    if (recording) {
      stopRecording()
    }
    const fileForUpload = await ensureWavFile(selectedFile)
    setSubmitting(true)
    setError('')
    setStatus('Analysing your take…')
    const formData = new FormData()
    formData.append('goal', goal)
    formData.append('file', fileForUpload, fileForUpload.name)
    try {
      const response = await fetch(`${API_BASE}/analyse`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        throw new Error(detail.detail || 'Analysis failed. Please try again.')
      }
      const payload = await response.json()
      setAnalysis(payload)
      setAnalysisGoal(goal)
      setStatus('Analysis complete. Dashboards now reflect your take.')
    } catch (err) {
      setError(err.message || 'Unable to analyse audio.')
      setStatus('')
    } finally {
      setSubmitting(false)
    }
  }

  const clearAnalysis = () => {
    setAnalysis(null)
    setAnalysisGoal(null)
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setStatus('Cleared previous analysis.')
  }

  const featureSummary = useMemo(() => {
    if (!analysis) return []
    const features = analysis.listening?.features ?? {}
    return [
      { label: 'Mean pitch', value: features.mean_pitch ? `${features.mean_pitch.toFixed(1)} Hz` : '--' },
      { label: 'Pitch stability', value: features.pitch_stability ? `${features.pitch_stability.toFixed(1)}¢` : '--' },
      { label: 'Dynamic range', value: features.dynamic_range ? features.dynamic_range.toFixed(2) : '--' },
      { label: 'Pitch confidence', value: features.pitch_confidence ? `${Math.round(features.pitch_confidence * 100)}%` : '--' },
    ]
  }, [analysis])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyse Your Voice</CardTitle>
        <CardDescription>
          Upload a clip or record a quick sample so the demo numbers switch over to your own voice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
          <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <span className="flex items-center gap-2 font-medium text-slate-100">
              <FileAudio size={16} /> Upload audio
            </span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="text-xs text-slate-300"
            />
            <span className="text-xs text-slate-400">
              Accepts WAV/MP3/M4A/OGG. Aim for 10–30 seconds of singing or spoken walkthrough.
            </span>
          </label>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 font-medium text-slate-100">
              <Mic size={16} /> Live capture
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {recording
                ? 'Recording… speak or sing your drill instructions, then press Stop.'
                : 'Press Start to capture a quick vocal snippet using your microphone.'}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  recording ? 'bg-rose-500/80 text-white hover:bg-rose-500' : 'bg-accent/20 text-accent hover:bg-accent/30'
                }`}
              >
                {recording ? (
                  <>
                    <X size={16} /> Stop
                  </>
                ) : (
                  <>
                    <Mic size={16} /> Start
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm text-slate-200">
            Practice goal
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent"
              value={goal}
              onChange={(event) => {
                setGoal(event.target.value)
                setAnalysisGoal(event.target.value)
              }}
            >
              {PRACTICE_GOALS.map((item) => (
                <option key={item.id} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitAudio}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              {submitting ? 'Analysing…' : 'Analyse take'}
            </button>
            {analysis ? (
              <button
                type="button"
                onClick={clearAnalysis}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-accent/50 hover:text-accent"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {previewUrl ? (
          <audio controls src={previewUrl} className="w-full rounded-xl bg-white/5">
            Your browser does not support the audio element.
          </audio>
        ) : null}

        {status ? (
          <div className="flex items-center gap-2 text-xs text-accent">
            <CheckCircle2 size={14} /> {status}
          </div>
        ) : null}
        {error ? (
          <div className="flex items-center gap-2 text-xs text-rose-300">
            <X size={14} /> {error}
          </div>
        ) : null}

        {analysis ? (
          <div className="grid gap-3 rounded-2xl border border-accent/20 bg-accent/10 p-4 text-sm text-slate-100 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-accent/80">Session</p>
              <p className="mt-1 text-sm">
                {analysis.meta?.filename ?? 'Uploaded take'} · {analysis.meta?.goal ?? goal}
              </p>
              <p className="text-xs text-slate-300/80">
                Duration {analysis.meta ? `${analysis.meta.duration_seconds?.toFixed(1)}s` : '--'} | Session ID{' '}
                {analysis.meta?.session_id ?? '--'}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              {featureSummary.map((item) => (
                <div key={item.label} className="rounded-xl bg-white/10 p-2">
                  <dt className="text-[10px] uppercase tracking-wide text-slate-300/80">{item.label}</dt>
                  <dd className="text-sm font-semibold text-white">{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-accent/80">Headline feedback</p>
              <p className="mt-1 text-sm text-slate-100">{analysis.feedback?.headline ?? '—'}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-200/90">
                {(analysis.feedback?.actions ?? []).slice(0, 3).map((action, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-accent">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function FeedbackSummaryCard({ showDeepAnalysis, onToggleDeepAnalysis }) {
  const { analysis } = useStudioData()

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feedback Summary</CardTitle>
          <CardDescription>
            Run an analysis to get instant feedback; until then the cards keep using the built-in demo data. You can
            still open Deep Analysis to explore the demo charts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-300/80">
            Once you run an analysis, headline feedback and drill suggestions will appear here for quick review.
          </p>
        </CardContent>
        <CardFooter>
          <button
            type="button"
            onClick={onToggleDeepAnalysis}
            className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20"
          >
            {showDeepAnalysis ? 'Hide Deep Analysis' : 'Open Deep Analysis'}
          </button>
        </CardFooter>
      </Card>
    )
  }

  const feedback = analysis.feedback ?? {}
  const insights = analysis.insights ?? []
  const coachMessage = analysis.coach_message
  const coachActions = analysis.coach_actions ?? []
  const drillSuggestions = insights
    .filter((item) => {
      const status = (item.status || '').toLowerCase()
      return ['needs attention', 'flat', 'hazy', 'wandering', 'wide', 'leaky', 'diffuse', 'blended', 'straight tone']
        .some((keyword) => status.includes(keyword))
    })
    .map((item) => {
      const trait = item.trait || 'Technique'
      return {
        trait,
        suggestion: INSIGHT_DRILL_MAP[trait] || 'Repeat the drill in the Choir Room focusing on this trait.',
      }
    })
    .slice(0, 3)

  return (
    <Card className="border-accent/30 bg-accent/10">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Feedback Summary</CardTitle>
            <CardDescription>
              Quick recap of your last take. Open Deep Analysis when you want the full charts.
            </CardDescription>
          </div>
          <button
            type="button"
            onClick={onToggleDeepAnalysis}
            className="inline-flex items-center gap-2 rounded-full border border-accent/50 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20"
          >
            {showDeepAnalysis ? 'Hide Deep Analysis' : 'Open Deep Analysis'}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent/80">Headline</p>
          <p className="mt-1 text-sm text-slate-100">{feedback.headline || 'Analysis ready—review charts for details.'}</p>
        </div>
        {coachActions.length || feedback.actions?.length ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-accent/80">Actionable next steps</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-100/90">
              {(coachActions.length ? coachActions : (feedback.actions ?? [])).slice(0, 4).map((action, index) => (
                <li key={index} className="flex gap-2">
                  <span className="text-accent">•</span>
                  <span>{action}</span>
                </li>
              ))}
          </ul>
        </div>
        ) : null}
        {drillSuggestions.length ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-accent/80">Suggested drills</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-100/90">
              {drillSuggestions.map((item, index) => (
                <li key={`${item.trait}-${index}`} className="flex flex-col gap-1 rounded-xl bg-white/10 p-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-300/80">{item.trait}</span>
                  <span>{item.suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {feedback.encouragement ? (
          <div className="rounded-xl bg-white/10 p-3 text-sm text-slate-100/90">
            {feedback.encouragement}
          </div>
        ) : null}
        {coachMessage ? (
          <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm text-slate-100">
            <p className="text-xs uppercase tracking-wide text-accent/80">Coach insight</p>
            <p className="mt-1 whitespace-pre-line text-sm">{coachMessage}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function IntonationCard() {
  const [targetHz, setTargetHz] = useState(440)
  const { analysis } = useStudioData()

  const generator = (prev) => {
    const nextTime = prev.length ? prev[prev.length - 1].time + 0.1 : 0
    const prevPitch = prev.length ? prev[prev.length - 1].measured : targetHz
    const drift = (Math.random() - 0.5) * 2
    const measured = Math.max(80, prevPitch + drift + (targetHz - prevPitch) * 0.05)
    const entry = { time: Number(nextTime.toFixed(1)), measured, target: targetHz }
    const updated = [...prev.slice(-(MAX_POINTS - 1)), entry]
    return updated
  }

  const { series, running, setRunning, reset } = useLiveSeries([], generator)

  const analysisSeries = useMemo(() => {
    if (!analysis?.listening?.pitch_contour?.length) return null
    const contour = analysis.listening.pitch_contour
    const times = analysis.listening.pitch_times ?? []
    return contour
      .map((value, index) => ({
        time: Number(((times[index] ?? index * 0.1)).toFixed(2)),
        measured: value ?? targetHz,
        target: targetHz,
      }))
      .filter((point) => Number.isFinite(point.measured))
  }, [analysis, targetHz])

  const dataset = analysisSeries ?? series
  const hasAnalysis = Boolean(analysisSeries && analysisSeries.length)

  useEffect(() => {
    setRunning(!hasAnalysis)
  }, [hasAnalysis, setRunning])

  const errors = useMemo(() => {
    return (dataset ?? []).map((point) => {
      const measured = point.measured > 0 ? point.measured : targetHz
      const reference = point.target || targetHz || 1
      const cents = 1200 * Math.log2(measured / reference)
      return {
        cents,
        abs: Math.abs(cents),
        inTune: Math.abs(cents) <= 20,
      }
    })
  }, [dataset, targetHz])

  const mae = errors.length
    ? (errors.reduce((acc, item) => acc + item.abs, 0) / errors.length).toFixed(1)
    : '0.0'
  const inTunePct = errors.length
    ? Math.round((errors.filter((item) => item.inTune).length / errors.length) * 100)
    : 0

  const histogram = useMemo(() => {
    const bins = Array.from({ length: 9 }, (_, idx) => ({
      range: `${-40 + idx * 10}`,
      count: 0,
    }))
    errors.forEach((item) => {
      const index = Math.max(0, Math.min(bins.length - 1, Math.floor((item.cents + 40) / 10)))
      bins[index].count += 1
    })
    return bins
  }, [errors])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intonation Accuracy</CardTitle>
        <CardDescription>
          See how closely your pitch follows the note you aimed for.
        </CardDescription>
        {hasAnalysis ? (
          <p className="text-xs text-accent/80">Showing data from your latest analysed take.</p>
        ) : (
          <p className="text-xs text-slate-400/80">Live simulator until you analyse a take.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row">
          <div className="h-56 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataset}>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="time" stroke="#94a3b8" tickFormatter={(value) => `${value}s`} />
                <YAxis stroke="#94a3b8" domain={[targetHz - 40, targetHz + 40]} />
                <Tooltip
                  formatter={(value, name) => [value.toFixed(2), name === 'measured' ? 'Measured Hz' : 'Target Hz']}
                  labelFormatter={(value) => `${value}s`}
                />
                <Line type="monotone" dataKey="measured" stroke="#36bffa" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="target" stroke="#22d3ee" dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-56 w-full max-w-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram}>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="range" stroke="#94a3b8" tickFormatter={(value) => `${value}¢`} />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip formatter={(value) => [`${value}`, 'Samples']} labelFormatter={(value) => `${value}¢`} />
                <Bar dataKey="count" fill="#818cf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <StatsGrid
          items={[
            { label: 'Target pitch', value: `${targetHz.toFixed(1)} Hz` },
            { label: 'Mean abs error', value: `${mae} ¢` },
            { label: 'In-tune time', value: `${inTunePct}%` },
            { label: 'Samples', value: dataset.length },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <span>Target frequency (Hz)</span>
            <input
              type="number"
              value={targetHz}
              min={60}
              max={1000}
              step={0.5}
              onChange={(event) => setTargetHz(Number(event.target.value) || 0)}
              className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-100 outline-none focus:border-accent"
            />
          </label>
        </div>
      </CardContent>
      <CardFooter>
        <ControlButtons
          running={running}
          onPause={() => setRunning(false)}
          onPlay={() => setRunning(true)}
          onReset={() => {
            setRunning(false)
            reset()
          }}
          disabled={hasAnalysis}
        />
        <span className="text-xs text-slate-400">Updates ~12 Hz</span>
      </CardFooter>
    </Card>
  )
}

function BreathSupportCard() {
  const [targetLevel, setTargetLevel] = useState(0.7)
  const { analysis } = useStudioData()
  const generator = (prev) => {
    const nextTime = prev.length ? prev[prev.length - 1].time + 0.1 : 0
    const previous = prev.length ? prev[prev.length - 1].flow : targetLevel
    const newValue = Math.min(
      1,
      Math.max(0, previous + (Math.random() - 0.5) * 0.05 + (targetLevel - previous) * 0.08),
    )
    const updated = [...prev.slice(-(MAX_POINTS - 1)), {
      time: Number(nextTime.toFixed(1)),
      flow: newValue,
      target: targetLevel,
    }]
    return updated
  }

  const { series, running, setRunning, reset } = useLiveSeries([], generator)

  const analysisSeries = useMemo(() => {
    const envelope = analysis?.listening?.rms_envelope
    if (!envelope || !envelope.length) return null
    const times = analysis.listening.rms_times ?? []
    const max = Math.max(...envelope, 0.001)
    return envelope.map((value, index) => ({
      time: Number(((times[index] ?? index * 0.1)).toFixed(1)),
      flow: clamp01(value / max),
      target: targetLevel,
    }))
  }, [analysis, targetLevel])

  const dataset = analysisSeries ?? series
  const hasAnalysis = Boolean(analysisSeries && analysisSeries.length)

  useEffect(() => {
    setRunning(!hasAnalysis)
  }, [hasAnalysis, setRunning])

  const stats = useMemo(() => {
    if (!dataset.length) {
      return { avg: '0%', stability: '0%' }
    }
    const average = dataset.reduce((sum, item) => sum + item.flow, 0) / dataset.length
    const variance =
      dataset.reduce((sum, item) => sum + (item.flow - average) ** 2, 0) / Math.max(1, dataset.length - 1)
    const normalisedStability = Math.max(0, 1 - Math.sqrt(variance) * 3)
    return {
      avg: `${Math.round(average * 100)}%`,
      stability: `${Math.round(normalisedStability * 100)}%`,
    }
  }, [dataset])

  const scatterData = useMemo(() => {
    if (dataset.length < 5) return []
    return dataset.slice(-60).map((item, index, arr) => {
      const window = arr.slice(Math.max(0, index - 10), index + 1)
      const avg = window.reduce((sum, sample) => sum + sample.flow, 0) / window.length
      const variance = window.reduce((sum, sample) => sum + (sample.flow - avg) ** 2, 0) / window.length
      return {
        flow: item.flow,
        stability: Math.max(0, 1 - variance * 10),
      }
    })
  }, [dataset])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Breath Support</CardTitle>
        <CardDescription>
          Check how steady your breath flow stays from start to finish.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataset}>
                <defs>
                  <linearGradient id="flowGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="time" stroke="#94a3b8" tickFormatter={(value) => `${value}s`} />
                <YAxis stroke="#94a3b8" domain={[0, 1]} />
                <Tooltip formatter={(value) => [`${(value * 100).toFixed(0)}%`, 'Flow']} />
                <Area dataKey="flow" stroke="#34d399" strokeWidth={2} fill="url(#flowGradient)" />
                <ReferenceLine y={targetLevel} stroke="#22d3ee" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" />
                <XAxis type="number" dataKey="flow" name="Flow" domain={[0, 1]} stroke="#94a3b8" />
                <YAxis type="number" dataKey="stability" name="Stability" domain={[0, 1]} stroke="#94a3b8" />
                <ZAxis type="number" dataKey="flow" range={[40, 120]} />
                <Tooltip
                  formatter={(value, name) => [`${(value * 100).toFixed(0)}%`, name]}
                  labelFormatter={() => ''}
                />
                <Scatter data={scatterData} fill="#38bdf8" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
        <StatsGrid
          items={[
            { label: 'Average flow', value: stats.avg },
            { label: 'Stability', value: stats.stability },
            { label: 'Target level', value: `${Math.round(targetLevel * 100)}%` },
            { label: 'Samples', value: dataset.length },
          ]}
        />
        <div className="flex flex-col gap-2">
          <label className="text-sm text-slate-200">Target support level</label>
          <input
            type="range"
            min={0.3}
            max={0.95}
            step={0.01}
            value={targetLevel}
            onChange={(event) => setTargetLevel(Number(event.target.value))}
            className="w-full accent-accent"
          />
        </div>
      </CardContent>
      <CardFooter>
        <ControlButtons
          running={running}
          onPause={() => setRunning(false)}
          onPlay={() => setRunning(true)}
          onReset={() => {
            setRunning(false)
            reset()
          }}
          disabled={hasAnalysis}
        />
        <span className="text-xs text-slate-400">Adjust slider to mirror breath targets</span>
      </CardFooter>
    </Card>
  )
}

function RangeExpansionCard() {
  const [safeLow, setSafeLow] = useState(55)
  const [safeHigh, setSafeHigh] = useState(82)
  const { analysis } = useStudioData()
  const [counts, setCounts] = useState(() => {
    const map = new Map()
    for (let midi = 40; midi <= 90; midi += 1) {
      map.set(midi, 0)
    }
    return map
  })
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      setCounts((prev) => {
        const next = new Map(prev)
        const center = (safeLow + safeHigh) / 2
        const spread = (safeHigh - safeLow) / 3
        const randomNote = Math.round(
          Math.min(
            90,
            Math.max(
              40,
              center + (Math.random() - 0.5) * spread * 2 + (Math.random() - 0.5) * 6,
            ),
          ),
        )
        next.set(randomNote, (next.get(randomNote) || 0) + 1)
        return next
      })
    }, TICK_INTERVAL)
    return () => clearInterval(interval)
  }, [running, safeHigh, safeLow])

  const analysisCounts = useMemo(() => {
    const contour = analysis?.listening?.pitch_contour
    if (!contour || !contour.length) return null
    const map = new Map()
    for (let midi = 40; midi <= 90; midi += 1) {
      map.set(midi, 0)
    }
    contour.forEach((hz) => {
      if (!hz || hz <= 0) return
      const midi = Math.round(69 + 12 * Math.log2(hz / 440))
      if (midi >= 40 && midi <= 90) {
        map.set(midi, (map.get(midi) || 0) + 1)
      }
    })
    return map
  }, [analysis])

  const data = useMemo(() => {
    const source = analysisCounts ?? counts
    return Array.from(source.entries()).map(([midi, value]) => ({ midi, hits: value }))
  }, [analysisCounts, counts])

  const [lowest, highest] = useMemo(() => {
    const source = analysisCounts ?? counts
    let min = null
    let max = null
    source.forEach((value, midi) => {
      if (value > 0) {
        if (min === null || midi < min) min = midi
        if (max === null || midi > max) max = midi
      }
    })
    return [min ?? '--', max ?? '--']
  }, [analysisCounts, counts])

  const reset = () => {
    const map = new Map()
    for (let midi = 40; midi <= 90; midi += 1) {
      map.set(midi, 0)
    }
    setCounts(map)
  }

  useEffect(() => {
    setRunning(!analysisCounts)
  }, [analysisCounts, setRunning])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Range Expansion</CardTitle>
        <CardDescription>
          Spot which notes you hit most and how they sit between your safe low and high marks.
        </CardDescription>
        {analysisCounts ? (
          <p className="text-xs text-accent/80">Histogram derived from analysed pitch contour.</p>
        ) : (
          <p className="text-xs text-slate-400/80">Simulator will continue until you analyse a take.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
              <XAxis dataKey="midi" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <ReferenceLine x={safeLow} stroke="#22d3ee" strokeDasharray="3 3" label="Safe Low" />
              <ReferenceLine x={safeHigh} stroke="#36bffa" strokeDasharray="3 3" label="Safe High" />
              <Bar dataKey="hits" fill="#c084fc" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <StatsGrid
          items={[
            { label: 'Lowest note', value: lowest },
            { label: 'Highest note', value: highest },
            { label: 'Safe low', value: safeLow },
            { label: 'Safe high', value: safeHigh },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <span>Safe low MIDI</span>
            <input
              type="number"
              value={safeLow}
              onChange={(event) => setSafeLow(Number(event.target.value))}
              className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-100 outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <span>Safe high MIDI</span>
            <input
              type="number"
              value={safeHigh}
              onChange={(event) => setSafeHigh(Number(event.target.value))}
              className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-100 outline-none focus:border-accent"
            />
          </label>
        </div>
      </CardContent>
      <CardFooter>
        <ControlButtons
          running={running}
          onPause={() => setRunning(false)}
          onPlay={() => setRunning(true)}
          onReset={() => {
            setRunning(false)
            reset()
          }}
          disabled={Boolean(analysisCounts)}
        />
        <span className="text-xs text-slate-400">Keep expansions within safe bounds</span>
      </CardFooter>
    </Card>
  )
}

function ExpressivityCard() {
  const targetProfile = useMemo(
    () => [
      { metric: 'Loudness', value: 0.75 },
      { metric: 'Vibrato', value: 0.6 },
      { metric: 'Brightness', value: 0.55 },
      { metric: 'Legato', value: 0.7 },
    ],
    [],
  )
  const { analysis } = useStudioData()

  const generator = (prev) => {
    const nextTime = prev.length ? prev[prev.length - 1].time + 0.1 : 0
    const previous = prev.at(-1)
    const next = {
      time: Number(nextTime.toFixed(1)),
      loudness: Math.min(0, Math.max(-24, (previous?.loudness ?? -12) + (Math.random() - 0.5) * 1.4)),
      vibrato: clamp01((previous?.vibrato ?? 0.6) + (Math.random() - 0.5) * 0.05),
      brightness: clamp01((previous?.brightness ?? 0.5) + (Math.random() - 0.5) * 0.05),
      legato: clamp01((previous?.legato ?? 0.65) + (Math.random() - 0.5) * 0.05),
    }
    return [...prev.slice(-(MAX_POINTS - 1)), next]
  }

  const { series, running, setRunning, reset } = useLiveSeries([], generator)

  const analysisSeries = useMemo(() => {
    const envelope = analysis?.listening?.rms_envelope
    if (!envelope || !envelope.length) return null
    const times = analysis.listening.rms_times ?? []
    const max = Math.max(...envelope, 0.001)
    const features = analysis.listening?.features ?? {}
    const vibratoNorm = clamp01((features.vibrato_depth ?? 0) / 80)
    const brightnessNorm = clamp01((features.spectral_centroid ?? 0) / 4000)
    const legatoNorm = clamp01(features.pitch_voiced_ratio ?? 0.6)
    return envelope.map((value, index) => ({
      time: Number(((times[index] ?? index * 0.1)).toFixed(1)),
      loudness: -24 + clamp01(value / max) * 18,
      vibrato: vibratoNorm,
      brightness: brightnessNorm,
      legato: legatoNorm,
    }))
  }, [analysis])

  const chartSeries = analysisSeries ?? series
  const hasAnalysis = Boolean(analysisSeries && analysisSeries.length)

  useEffect(() => {
    setRunning(!hasAnalysis)
  }, [hasAnalysis, setRunning])

  const latest = chartSeries.at(-1)
  const features = analysis?.listening?.features ?? {}
  const currentProfile = useMemo(() => {
    if (analysis) {
      return [
        { metric: 'Loudness', value: clamp01((features.mean_energy ?? 0) * 1.5) },
        { metric: 'Vibrato', value: clamp01((features.vibrato_depth ?? 0) / 80) },
        { metric: 'Brightness', value: clamp01((features.spectral_centroid ?? 0) / 4000) },
        { metric: 'Legato', value: clamp01(features.pitch_voiced_ratio ?? 0.6) },
      ]
    }
    const loudness = latest ? clamp01(Math.abs(latest.loudness) / 24) : 0
    return [
      { metric: 'Loudness', value: loudness },
      { metric: 'Vibrato', value: latest ? latest.vibrato : 0 },
      { metric: 'Brightness', value: latest ? latest.brightness : 0 },
      { metric: 'Legato', value: latest ? latest.legato : 0 },
    ]
  }, [analysis, features, latest])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expressivity</CardTitle>
        <CardDescription>
          Follow loudness, vibrato, brightness, and smoothness to shape the story of your phrase.
        </CardDescription>
        {hasAnalysis ? (
          <p className="text-xs text-accent/80">Expressivity curves based on your analysed take.</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartSeries}>
              <CartesianGrid stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="time" stroke="#94a3b8" tickFormatter={(value) => `${value}s`} />
              <YAxis yAxisId="left" stroke="#94a3b8" domain={[-24, 0]} />
              <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" domain={[0, 1]} />
              <Tooltip />
              <Line yAxisId="left" type="monotone" dataKey="loudness" stroke="#f97316" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="vibrato" stroke="#22d3ee" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="brightness" stroke="#a855f7" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="legato" stroke="#34d399" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={currentProfile.map((item, idx) => ({
              metric: item.metric,
              current: item.value,
              target: targetProfile[idx].value,
            }))}>
              <PolarGrid stroke="rgba(148,163,184,0.2)" />
              <PolarAngleAxis dataKey="metric" stroke="#94a3b8" />
              <PolarRadiusAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} domain={[0, 1]} />
              <Radar name="Current" dataKey="current" stroke="#36bffa" fill="#36bffa" fillOpacity={0.45} />
              <Radar name="Target" dataKey="target" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <StatsGrid
          items={[
            { label: 'Current loudness', value: latest ? `${latest.loudness.toFixed(1)} dB` : '--' },
            { label: 'Vibrato', value: latest ? `${Math.round((latest.vibrato ?? 0) * 100)}%` : '--' },
            { label: 'Brightness', value: latest ? `${Math.round((latest.brightness ?? 0) * 100)}%` : '--' },
            { label: 'Legato', value: latest ? `${Math.round((latest.legato ?? 0) * 100)}%` : '--' },
          ]}
        />
      </CardContent>
      <CardFooter>
        <ControlButtons
          running={running}
          onPause={() => setRunning(false)}
          onPlay={() => setRunning(true)}
          onReset={() => {
            setRunning(false)
            reset()
          }}
          disabled={hasAnalysis}
        />
        <span className="text-xs text-slate-400">Overlay target expressivity signatures</span>
      </CardFooter>
    </Card>
  )
}

function PerformanceConfidenceCard() {
  const { analysis } = useStudioData()

  const generator = (prev) => {
    const nextTime = prev.length ? prev[prev.length - 1].time + 0.1 : 0
    const previous = prev.length ? prev[prev.length - 1].focus : 0.85
    const jitter = (Math.random() - 0.5) * 0.08
    let focus = clamp01(previous + jitter)
    let error = false
    let recovery = false
    if (Math.random() < 0.05) {
      focus = clamp01(previous - 0.25 - Math.random() * 0.2)
      error = true
    } else if (previous < 0.6 && Math.random() < 0.4) {
      focus = clamp01(previous + 0.3 + Math.random() * 0.2)
      recovery = true
    }
    const entry = { time: Number(nextTime.toFixed(1)), focus, target: 0.8, error, recovery }
    return [...prev.slice(-(MAX_POINTS - 1)), entry]
  }

  const { series, running, setRunning, reset } = useLiveSeries([], generator)

  const analysisSeries = useMemo(() => {
    const probs = analysis?.listening?.pitch_voiced_probabilities
    if (!probs || !probs.length) return null
    const times = analysis.listening.pitch_times ?? []
    return probs.map((value, index) => {
      const focus = clamp01(value ?? 0)
      const prev = index > 0 ? clamp01(probs[index - 1] ?? 0) : focus
      return {
        time: Number(((times[index] ?? index * 0.1)).toFixed(1)),
        focus,
        target: 0.8,
        error: focus < 0.45,
        recovery: prev < 0.45 && focus >= 0.7,
      }
    })
  }, [analysis])

  const dataset = analysisSeries ?? series
  const hasAnalysis = Boolean(analysisSeries && analysisSeries.length)

  useEffect(() => {
    setRunning(!hasAnalysis)
  }, [hasAnalysis, setRunning])

  const stats = useMemo(() => {
    if (!dataset.length) return { focus: '0%', errors: 0, recoveries: 0 }
    const focusAvg = dataset.reduce((sum, item) => sum + item.focus, 0) / dataset.length
    const errors = dataset.filter((item) => item.error).length
    const recoveries = dataset.filter((item) => item.recovery).length
    return {
      focus: `${Math.round(focusAvg * 100)}%`,
      errors,
      recoveries,
    }
  }, [dataset])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Confidence</CardTitle>
        <CardDescription>
          Track how focused you stay and where slips or recoveries happen.
        </CardDescription>
        {hasAnalysis ? (
          <p className="text-xs text-accent/80">Confidence trace based on voiced-probability from your analysed take.</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dataset}>
              <defs>
                <linearGradient id="focusGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="time" stroke="#94a3b8" tickFormatter={(value) => `${value}s`} />
              <YAxis stroke="#94a3b8" domain={[0, 1]} />
              <Tooltip />
              <Area dataKey="focus" stroke="#38bdf8" strokeWidth={2} fill="url(#focusGradient)" />
              <ReferenceLine y={0.8} stroke="#f97316" strokeDasharray="4 4" label="Target" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <StatsGrid
          items={[
            { label: 'Focus time', value: stats.focus },
            { label: 'Recoveries', value: stats.recoveries },
            { label: 'Errors', value: stats.errors },
            { label: 'Target focus', value: '80%' },
          ]}
        />
      </CardContent>
      <CardFooter>
        <ControlButtons
          running={running}
          onPause={() => setRunning(false)}
          onPlay={() => setRunning(true)}
          onReset={() => {
            setRunning(false)
            reset()
          }}
          disabled={hasAnalysis}
        />
        <span className="text-xs text-slate-400">Log confidence dips to design resets</span>
      </CardFooter>
    </Card>
  )
}

export default function PracticeStudioPage() {
  const { analysis } = useStudioData()
  const [showDeepAnalysis, setShowDeepAnalysis] = useState(true)

  useEffect(() => {
    setShowDeepAnalysis(!analysis)
  }, [analysis])

  const shouldShowCharts = showDeepAnalysis

  return (
    <div className="space-y-12 pb-16">
      <header className="space-y-3 text-slate-100">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-300/70">Vocal Coach</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Vocal Lab</h1>
          <p className="max-w-2xl text-base text-slate-300/80">
            Explore interactive drills for pitch, breath, range, expression, and confidence. Everything starts in demo
            mode—drop in your own audio to see the real measurements.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowDeepAnalysis((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20"
        >
          {showDeepAnalysis ? 'Hide Deep Analysis' : 'Open Deep Analysis'}
        </button>
      </header>

      <AnalysisInputCard />

      <FeedbackSummaryCard
        showDeepAnalysis={showDeepAnalysis}
        onToggleDeepAnalysis={() => setShowDeepAnalysis((prev) => !prev)}
      />

      {shouldShowCharts ? (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <IntonationCard />
          <BreathSupportCard />
          <RangeExpansionCard />
          <ExpressivityCard />
          <PerformanceConfidenceCard />
        </section>
      ) : (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle>Deep Analysis Hidden</CardTitle>
          <CardDescription>
            Charts are hidden for now. Tap “Open Deep Analysis” if you want to dig into the visuals again.
          </CardDescription>
          </CardHeader>
        </Card>
      )}

      <footer className="text-xs text-slate-400/80">
        Tip: Replace simulated data with your real audio analysis metrics (pitch, loudness, spectral features, breath
        sensors). Keep inference local for privacy.
      </footer>
    </div>
  )
}
