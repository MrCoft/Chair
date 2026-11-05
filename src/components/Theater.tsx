import type { Bookmarks, Movie } from '@/format/movie'
import { CaptionBox } from '@/components/CaptionBox'
import { Controls } from '@/components/Controls'
import { Screen } from '@/components/Screen'
import { ScrubBar } from '@/components/ScrubBar'
import { usePlayer } from '@/player/PlayerContext'

export const Theater = ({
    movie,
    bookmarks,
    videoSrc,
    onToggleBookmark,
}: {
    movie: Movie
    bookmarks: Bookmarks
    videoSrc: string
    onToggleBookmark: (code: string) => void
}) => {
    const { currentStep } = usePlayer()

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <Screen movie={movie} videoSrc={videoSrc}>
                <CaptionBox step={currentStep} />
            </Screen>
            <div className="flex flex-col gap-2 border-t px-4 pt-3 pb-3">
                <ScrubBar movie={movie} bookmarks={bookmarks} />
                <Controls movie={movie} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />
            </div>
        </div>
    )
}
