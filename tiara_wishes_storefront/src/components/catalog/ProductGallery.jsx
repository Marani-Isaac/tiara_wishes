import { useState } from 'react'
import { mediaUrl } from '../../utils/format'

export default function ProductGallery({ images, name }) {
  const list = images?.length ? images : []
  const [index, setIndex] = useState(0)
  const current = list[index]

  if (!current) {
    return (
      <div className="media-fallback product-stage rounded-2xl" aria-hidden="true">
        {(name || 'T').slice(0, 1)}
      </div>
    )
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowRight') setIndex((value) => (value + 1) % list.length)
    if (event.key === 'ArrowLeft') setIndex((value) => (value - 1 + list.length) % list.length)
  }

  return (
    <div onKeyDown={onKeyDown}>
      <img
        className="product-stage rounded-2xl object-cover"
        src={mediaUrl(current.image_url)}
        alt={current.alt_text || name}
        width="800"
        height="1000"
      />
      {list.length > 1 ? (
        <div className="mt-3 flex gap-2" role="list">
          {list.map((image, imageIndex) => (
            <button
              key={image.id || imageIndex}
              type="button"
              className={`h-16 w-16 overflow-hidden rounded-xl border ${imageIndex === index ? 'border-ink' : 'border-line'}`}
              onClick={() => setIndex(imageIndex)}
              aria-label={`Show image ${imageIndex + 1}`}
              aria-current={imageIndex === index}
            >
              <img src={mediaUrl(image.image_url)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
