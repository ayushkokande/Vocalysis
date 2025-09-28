import { ChoirRoom } from '../components/choir-room'

export default function ChoirRoomPage() {
  return (
    <div className="space-y-12 pb-16 text-slate-100">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.35em] text-slate-300/70">Vocal Coach</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Choir Room</h1>
        <p className="max-w-2xl text-base text-slate-300/80">
          Narrate each drill aloud. The mentor listens to your explanation, scores focus, and suggests technique cues to
          refine your self-guided practice.
        </p>
      </header>

      <ChoirRoom />
    </div>
  )
}
