import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Movie, Step } from '@/format/movie'
import { stepAt } from '@/player/timeline'

export type Player = {
    attach: (el: HTMLVideoElement | null) => void
    currentMs: number
    currentStep: Step
    playing: boolean
    rate: number
    setRate: (r: number) => void
    togglePlay: () => void
    seekToMs: (ms: number) => void
    seekToStep: (code: string) => void
    videoFailed: boolean
}

const PlayerContext = createContext<Player | null>(null)

const toMs = (seconds: number): number => Math.round(seconds * 1000)

export const PlayerProvider = ({
    movie,
    initialMs = 0,
    children,
}: {
    movie: Movie
    initialMs?: number
    children: ReactNode
}) => {
    const [currentMs, setCurrentMs] = useState(initialMs)
    const [playing, setPlaying] = useState(false)
    const [rate, setRateState] = useState(1)
    const [videoFailed, setVideoFailed] = useState(false)

    const videoRef = useRef<HTMLVideoElement | null>(null)
    const detachRef = useRef<(() => void) | null>(null)
    const msRef = useRef(initialMs)
    const playingRef = useRef(false)
    const rateRef = useRef(1)

    const updateMs = useCallback((ms: number) => {
        msRef.current = ms
        setCurrentMs(ms)
    }, [])

    const updatePlaying = useCallback((value: boolean) => {
        playingRef.current = value
        setPlaying(value)
    }, [])

    const play = useCallback(
        (el: HTMLVideoElement) => {
            el.play().catch(() => updatePlaying(false))
        },
        [updatePlaying],
    )

    const seekToMs = useCallback(
        (ms: number) => {
            const target = Math.min(Math.max(ms, 0), movie.durationMs)
            const el = videoRef.current
            if (el) el.currentTime = target / 1000
            updateMs(target)
        },
        [movie.durationMs, updateMs],
    )

    const stopAt = useCallback(
        (ms: number) => {
            seekToMs(ms)
            updatePlaying(false)
            const el = videoRef.current
            if (el && !el.paused) el.pause()
        },
        [seekToMs, updatePlaying],
    )

    const followVideo = useCallback(() => {
        const el = videoRef.current
        if (!el) return
        const previous = msRef.current
        const ms = toMs(el.currentTime)
        if (ms === previous) return
        const entered = el.paused
            ? undefined
            : movie.steps.find((step) => previous < step.startMs && step.startMs <= ms)
        if (entered) stopAt(entered.startMs)
        else updateMs(ms)
    }, [movie.steps, stopAt, updateMs])

    const followRef = useRef(followVideo)
    useEffect(() => {
        followRef.current = followVideo
    }, [followVideo])

    const attach = useCallback(
        (el: HTMLVideoElement | null) => {
            if (videoRef.current === el) return
            detachRef.current?.()
            detachRef.current = null
            videoRef.current = el
            if (!el) return

            const sync = () => updateMs(toMs(el.currentTime))
            const listeners: Array<[string, () => void]> = [
                ['timeupdate', () => followRef.current()],
                ['seeked', sync],
                ['play', () => updatePlaying(true)],
                [
                    'pause',
                    () => {
                        updatePlaying(false)
                        sync()
                    },
                ],
                [
                    'ratechange',
                    () => {
                        rateRef.current = el.playbackRate
                        setRateState(el.playbackRate)
                    },
                ],
                ['error', () => setVideoFailed(true)],
                ['loadstart', () => setVideoFailed(false)],
            ]
            for (const [type, listener] of listeners) el.addEventListener(type, listener)
            detachRef.current = () => {
                for (const [type, listener] of listeners) el.removeEventListener(type, listener)
            }

            if (toMs(el.currentTime) !== msRef.current) el.currentTime = msRef.current / 1000
            if (el.playbackRate !== rateRef.current) el.playbackRate = rateRef.current
            setVideoFailed(Boolean(el.error))
            if (playingRef.current) play(el)
        },
        [play, updateMs, updatePlaying],
    )

    useEffect(() => {
        if (!playing) return
        let frame = requestAnimationFrame(function tick() {
            followRef.current()
            frame = requestAnimationFrame(tick)
        })
        return () => cancelAnimationFrame(frame)
    }, [playing])

    const seekToStep = useCallback(
        (code: string) => {
            const step = movie.steps.find((candidate) => candidate.code === code)
            if (step) stopAt(step.startMs)
        },
        [movie.steps, stopAt],
    )

    const togglePlay = useCallback(() => {
        const el = videoRef.current
        if (!el) return
        if (el.paused) play(el)
        else el.pause()
    }, [play])

    const setRate = useCallback((r: number) => {
        rateRef.current = r
        setRateState(r)
        if (videoRef.current) videoRef.current.playbackRate = r
    }, [])

    const value: Player = {
        attach,
        currentMs,
        currentStep: stepAt(movie.steps, currentMs),
        playing,
        rate,
        setRate,
        togglePlay,
        seekToMs,
        seekToStep,
        videoFailed,
    }

    return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export const usePlayer = (): Player => {
    const player = useContext(PlayerContext)
    if (!player) throw new Error('usePlayer must be used inside a PlayerProvider')
    return player
}
