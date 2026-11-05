import type { Inline } from '@/format/caption'
import { parseCaption } from '@/format/caption'

const InlinePart = ({ part }: { part: Inline }) => {
    switch (part.kind) {
        case 'break':
            return <br />
        case 'bold':
            return <strong className="font-semibold">{part.text}</strong>
        case 'italic':
            return <em>{part.text}</em>
        case 'code':
            return <code className="rounded bg-white/10 px-1 font-mono text-[0.9em]">{part.text}</code>
        case 'text':
            return <>{part.text}</>
    }
}

export const CaptionText = ({ text, className }: { text: string; className?: string }) => (
    <div className={className}>
        {parseCaption(text).map((paragraph, index) => (
            <p key={index} className="mt-1.5 first:mt-0">
                {paragraph.map((part, partIndex) => (
                    <InlinePart key={partIndex} part={part} />
                ))}
            </p>
        ))}
    </div>
)
