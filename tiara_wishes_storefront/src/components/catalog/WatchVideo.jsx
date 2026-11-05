import { useState } from 'react'
import { Button } from '../common/Button'
import { Modal } from '../common/States'
import { videoSource } from '../../utils/video'

function VideoStage({ source, name }) {
  if (source.kind === 'file') {
    return (
      <video className="video-stage" controls playsInline preload="metadata" src={source.src}>
        <a href={source.src}>Open video</a>
      </video>
    )
  }
  return (
    <iframe
      className={source.shape === 'tall' ? 'video-stage video-stage-tall' : 'video-stage'}
      src={source.src}
      title={`Usage video for ${name}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}

export default function WatchVideo({ url, name }) {
  const source = videoSource(url)
  const [open, setOpen] = useState(false)
  if (!source) return null

  if (source.kind === 'link') {
    return (
      <a className="btn btn-ghost" href={source.src} target="_blank" rel="noopener noreferrer">
        Watch video
      </a>
    )
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Watch video
      </Button>
      <Modal open={open} wide title="Watch video" onClose={() => setOpen(false)}>
        {open ? <VideoStage source={source} name={name} /> : null}
      </Modal>
    </>
  )
}
