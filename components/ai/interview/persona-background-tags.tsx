export default function PersonaBackgroundTags({tags}: {tags: string[]}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="border-hairline bg-paper text-ink rounded-full border px-2 py-0.5 text-xs"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}
