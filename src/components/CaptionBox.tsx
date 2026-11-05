import type { Step } from '@/format/movie'
import { CaptionText } from '@/components/CaptionText'

export const CaptionBox = ({ step }: { step: Step }) => (
    <section
        aria-label="Caption"
        className="absolute bottom-[4%] left-[2.5%] max-w-[52%] rounded-lg border-2 border-[#ffcc66] bg-[rgba(18,22,48,0.94)] px-4 py-3 text-left text-[15px] leading-snug text-white shadow-lg"
    >
        <p className="font-bold text-[#ffcc66]">
            <span>{step.code}</span> · <span>{step.title}</span>
        </p>
        <CaptionText text={step.text} className="mt-1" />
    </section>
)
