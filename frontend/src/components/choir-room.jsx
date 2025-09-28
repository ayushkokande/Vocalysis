import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, FileAudio, Loader2, Mic, Square, Upload, X } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

const DRILL_GOAL_MAP = {
  intonation: 'Intonation Accuracy',
  breath: 'Breath Support',
  range: 'Range Expansion',
  expressivity: 'Expressivity',
  confidence: 'Performance Confidence',
}

const DRILL_FOCUS_TRAITS = {
  intonation: ['Pitch Control', 'Rhythmic Steadiness'],
  breath: ['Breath Management', 'Dynamic Control'],
  range: ['Pitch Control', 'Vibrato Control'],
  expressivity: ['Vibrato Control', 'Phrase Shaping', 'Emotional Impact'],
  confidence: ['Breath Management', 'Rhythmic Steadiness'],
}

const DRILLS = [
  {
    key: 'intonation',
    title: 'Intonation Drill',
    focus: 'Match the note',
    description: 'Hold one note and try to keep it in tune the whole time.',
    steps: [
      'Pick a comfortable note from a tuner or piano.',
      'Hold it on a simple “ah” or “oo”.',
      'Keep listening and nudge the pitch when it drifts.',
    ],
  },
  {
    key: 'breath',
    title: 'Breath Support Drill',
    focus: 'Steady breath flow',
    description: 'See if your breath stays smooth from start to finish.',
    steps: [
      'Breathe in for four counts, expanding ribs all around.',
      'Let the air out on a hiss or vowel for eight counts.',
      'Keep the sound even and avoid rushing at the end.',
    ],
  },
  {
    key: 'range',
    title: 'Range Drill',
    focus: 'Reach your high and low notes',
    description: 'Slide from your low note to your high note smoothly.',
    steps: [
      'Pick a starting low note and the high note you want to reach.',
      'Glide up in a gentle crescendo, keeping the jaw relaxed.',
      'Glide back down softly, keeping breath steady.',
    ],
  },
  {
    key: 'expressivity',
    title: 'Expressivity Drill',
    focus: 'Sing with colour',
    description: 'Shape one short line with a clear emotional plan.',
    steps: [
      'Pick a short lyric or vowel you want to colour.',
      'Decide where you’ll swell, soften, or add vibrato.',
      'Sing it, then try again with a stronger feeling.',
    ],
  },
  {
    key: 'confidence',
    title: 'Confidence Drill',
    focus: 'Stay steady under pressure',
    description: 'Pretend you’re on stage and keep your delivery calm.',
    steps: [
      'Picture the stage or room you’ll sing in.',
      'Plant your feet, take a calm breath, sing the line.',
      'If you wobble, breathe once and try again right away.',
    ],
  },
]

const initialSessionState = () =>
  DRILLS.reduce((acc, drill) => {
    acc[drill.key] = {
      recording: false,
      selectedFile: null,
      previewUrl: '',
      submitting: false,
      status: '',
      error: '',
      analysis: null,
    }
    return acc
  }, {})

function ensureMediaRecorder(refs, chunksRef, key) {
  if (!refs.current[key]) {
    refs.current[key] = { recorder: null, stream: null }
  }
  if (!chunksRef.current[key]) {
    chunksRef.current[key] = []
  }
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
    const buffer = new ArrayBuffer(44 + mono.length * bytesPerSample)
    const view = new DataView(buffer)
    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + mono.length * bytesPerSample, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * bytesPerSample, true)
    view.setUint16(32, bytesPerSample, true)
    view.setUint16(34, bytesPerSample * 8, true)
    writeString(view, 36, 'data')
    view.setUint32(40, mono.length * bytesPerSample, true)
    floatTo16BitPCM(view, 44, mono)
    await audioContext.close()
    return new File([buffer], `${file.name.replace(/\.[^/.]+$/, '') || 'take'}.wav`, { type: 'audio/wav' })
  } catch (err) {
    console.error('Failed to convert audio to WAV, falling back to original file.', err)
    return file
  }
}

export function ChoirRoom() {
  const [sessions, setSessions] = useState(initialSessionState)
  const sessionsRef = useRef(sessions)
  const mediaRecorderRefs = useRef({})
  const recordedChunksRef = useRef({})

  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  const updateSession = (key, updates) => {
    setSessions((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...updates,
      },
    }))
  }

  const handleFileChange = (key, file) => {
    if (!file) return
    const current = sessions[key]
    if (current.previewUrl) URL.revokeObjectURL(current.previewUrl)
    const url = URL.createObjectURL(file)
    updateSession(key, {
      selectedFile: file,
      previewUrl: url,
      status: 'Ready to analyse uploaded file.',
      error: '',
    })
  }

  const startRecording = async (key) => {
    ensureMediaRecorder(mediaRecorderRefs, recordedChunksRef, key)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recordedChunksRef.current[key] = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current[key].push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current[key], { type: 'audio/webm' })
        const file = new File([blob], `choir-${key}-${Date.now()}.webm`, { type: blob.type })
        const prev = sessions[key]
        if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        const url = URL.createObjectURL(blob)
        updateSession(key, {
          recording: false,
          selectedFile: file,
          previewUrl: url,
          status: 'Recording captured. Ready to analyse.',
        })
      }
      mediaRecorderRefs.current[key] = { recorder, stream }
      recorder.start()
      updateSession(key, {
        recording: true,
        status: 'Recording… sing the drill then press Stop.',
        error: '',
        analysis: null,
      })
    } catch (err) {
      updateSession(key, {
        error: 'Could not access the microphone. Allow audio recording or upload a file instead.',
      })
    }
  }

  const stopRecording = (key) => {
    const current = mediaRecorderRefs.current[key]
    if (!current?.recorder) return
    if (current.recorder.state !== 'inactive') {
      current.recorder.stop()
    }
    current.stream.getTracks().forEach((track) => track.stop())
    mediaRecorderRefs.current[key] = { recorder: null, stream: null }
  }

  const analyseDrill = async (key) => {
    const session = sessions[key]
    const goal = DRILL_GOAL_MAP[key]
    if (!session.selectedFile) {
      updateSession(key, { error: 'Upload or record a short take first.' })
      return
    }
    if (session.recording) {
      stopRecording(key)
    }
    updateSession(key, { submitting: true, error: '', status: 'Analysing your take…' })
    const fileToUpload = await ensureWavFile(session.selectedFile)
    const formData = new FormData()
    formData.append('goal', goal)
    formData.append('file', fileToUpload, fileToUpload.name)
    const focusTraits = DRILL_FOCUS_TRAITS[key]
    if (focusTraits?.length) {
      formData.append('focus_traits', JSON.stringify(focusTraits))
    }
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
      updateSession(key, {
        analysis: payload,
        submitting: false,
        status: 'Analysis complete.',
      })
    } catch (err) {
      updateSession(key, {
        submitting: false,
        error: err.message || 'Unable to analyse audio.',
        status: '',
      })
    }
  }

  useEffect(() => {
    return () => {
      DRILLS.forEach((drill) => {
        const current = mediaRecorderRefs.current[drill.key]
        if (current?.recorder) {
          current.recorder.stop()
          current.stream.getTracks().forEach((track) => track.stop())
        }
        const preview = sessionsRef.current[drill.key]?.previewUrl
        if (preview) {
          URL.revokeObjectURL(preview)
        }
      })
    }
  }, [])

  return (
    <div className="mt-10 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Choir Room</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-300/80">
          Pick a drill, record or upload a short take, and the mentor will break down how it went.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {DRILLS.map((drill) => {
          const session = sessions[drill.key]
          const analysis = session.analysis
          const insights = analysis?.insights ?? []
          const feedback = analysis?.feedback
          const coachMessage = analysis?.coach_message
          const coachActions = analysis?.coach_actions ?? []
          const actionsToDisplay = coachActions.length
            ? coachActions
            : (feedback?.actions ?? []).slice(0, 3)

          return (
            <Card key={drill.key} className={session.recording ? 'border-accent/60 shadow-accent/30 shadow-lg' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{drill.title}</span>
                  <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
                    {drill.focus}
                  </span>
                </CardTitle>
                <CardDescription>{drill.description}</CardDescription>
                <ul className="mt-2 space-y-1 text-xs text-slate-300/90">
                  {drill.steps.map((step, index) => (
                    <li key={`${drill.key}-step-${index}`}>{step}</li>
                  ))}
                </ul>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <span className="flex items-center gap-2 font-medium text-slate-100">
                      <FileAudio size={16} /> Upload audio
                    </span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(event) => handleFileChange(drill.key, event.target.files?.[0])}
                      className="text-xs text-slate-300"
                    />
                    <span className="text-xs text-slate-400">10–30 seconds is plenty.</span>
                  </label>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 font-medium text-slate-100">
                      <Mic size={16} /> Live capture
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {session.recording
                        ? 'Recording… sing the drill and hit Stop when you are done.'
                        : 'Press Start and capture a quick run of this drill.'}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          session.recording ? stopRecording(drill.key) : startRecording(drill.key)
                        }
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          session.recording
                            ? 'bg-rose-500/80 text-white hover:bg-rose-500'
                            : 'bg-accent/20 text-accent hover:bg-accent/30'
                        }`}
                      >
                        {session.recording ? (
                          <>
                            <Square size={16} /> Stop
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

                {session.previewUrl ? (
                  <audio controls src={session.previewUrl} className="w-full rounded-xl bg-white/5">
                    Your browser does not support the audio element.
                  </audio>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => analyseDrill(drill.key)}
                    disabled={session.submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {session.submitting ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                    {session.submitting ? 'Analysing…' : 'Analyse take'}
                  </button>
                  {session.status ? (
                    <span className="text-xs text-accent flex items-center gap-2">
                      <CheckCircle2 size={14} /> {session.status}
                    </span>
                  ) : null}
                  {session.error ? (
                    <span className="text-xs text-rose-300 flex items-center gap-2">
                      <X size={14} /> {session.error}
                    </span>
                  ) : null}
                </div>

                {analysis ? (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-accent/80">Headline</p>
                      <p className="mt-1 text-sm">{feedback?.headline ?? 'Analysis ready.'}</p>
                    </div>
                    {actionsToDisplay.length ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-accent/80">Next steps</p>
                        <ul className="mt-1 space-y-1 text-sm text-slate-100/90">
                          {actionsToDisplay.map((action, idx) => (
                            <li key={`${drill.key}-action-${idx}`} className="flex gap-2">
                              <span className="text-accent">•</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div>
                      <p className="text-xs uppercase tracking-wide text-accent/80">Insights</p>
                      <ul className="mt-1 space-y-1 text-sm text-slate-100/80">
                        {insights.slice(0, 4).map((insight, index) => (
                          <li key={`${drill.key}-insight-${index}`} className="rounded-lg bg-white/10 px-3 py-2">
                            <strong className="text-slate-50">{insight.trait}</strong>: {insight.status}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {coachMessage ? (
                      <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs text-slate-100">
                        <p className="text-[10px] uppercase tracking-wide text-accent/80">Coach insight</p>
                        <p className="mt-1 whitespace-pre-line text-sm">{coachMessage}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
