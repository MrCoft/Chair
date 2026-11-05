import type { ReactNode } from 'react'
import type { Movie } from '@/format/movie'
import { usePlayer } from '@/player/PlayerContext'

export const Screen = ({ movie, videoSrc, children }: { movie: Movie; videoSrc: string; children?: ReactNode }) => {
    const { attach, togglePlay, videoFailed } = usePlayer()

    return (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black" style={{ containerType: 'size' }}>
            <div className="relative aspect-video" style={{ width: 'min(100cqw, 100cqh * 16 / 9)' }}>
                <video
                    ref={attach}
                    src={videoSrc}
                    preload="auto"
                    playsInline
                    onClick={togglePlay}
                    className="absolute inset-0 h-full w-full object-contain"
                />
                {videoFailed && (
                    <p className="absolute inset-0 flex items-center justify-center p-8 text-center text-muted-foreground">
                        Can't play {movie.video} — the file is missing or unreadable.
                    </p>
                )}
                {children}
            </div>
        </div>
    )
}
