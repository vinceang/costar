interface Props {
  url: string | null
  name: string
  className?: string
}

/** Actor headshot with an initials fallback when TMDB has no profile image. */
export function Portrait({ url, name, className = '' }: Props) {
  return (
    <div className={`portrait ${className}`}>
      {url ? (
        <img src={url} alt={name} draggable={false} loading="eager" />
      ) : (
        <span className="portrait-initials" aria-hidden>
          {name
            .split(' ')
            .slice(0, 2)
            .map((w) => w[0])
            .join('')}
        </span>
      )}
    </div>
  )
}
