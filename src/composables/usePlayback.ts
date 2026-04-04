import { ref, onUnmounted } from 'vue'

export function usePlayback(totalDuration: () => number) {
  const currentTime = ref(0)
  const playing = ref(false)
  const speed = ref(1)
  let rafId: number | null = null
  let lastFrameTime: number | null = null

  function tick(timestamp: number) {
    if (!playing.value) return
    if (lastFrameTime === null) {
      lastFrameTime = timestamp
      rafId = requestAnimationFrame(tick)
      return
    }
    const delta = (timestamp - lastFrameTime) / 1000
    lastFrameTime = timestamp
    currentTime.value = Math.min(currentTime.value + delta * speed.value, totalDuration())

    if (currentTime.value >= totalDuration()) {
      playing.value = false
      lastFrameTime = null
      return
    }
    rafId = requestAnimationFrame(tick)
  }

  function play() {
    if (currentTime.value >= totalDuration()) {
      currentTime.value = 0
    }
    playing.value = true
    lastFrameTime = null
    rafId = requestAnimationFrame(tick)
  }

  function pause() {
    playing.value = false
    lastFrameTime = null
    if (rafId !== null) cancelAnimationFrame(rafId)
  }

  function togglePlay() {
    if (playing.value) pause()
    else play()
  }

  function seek(t: number) {
    currentTime.value = Math.max(0, Math.min(t, totalDuration()))
  }

  function toggleSpeed() {
    const speeds = [1, 2, 4]
    const idx = speeds.indexOf(speed.value)
    speed.value = speeds[(idx + 1) % speeds.length]
  }

  onUnmounted(() => {
    if (rafId !== null) cancelAnimationFrame(rafId)
  })

  return { currentTime, playing, speed, play, pause, togglePlay, seek, toggleSpeed }
}
