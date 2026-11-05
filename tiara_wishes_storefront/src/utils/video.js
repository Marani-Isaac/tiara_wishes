function youtubeId(url) {
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || ''
  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'music.youtube.com') return ''
  const fromQuery = url.searchParams.get('v')
  if (fromQuery) return fromQuery
  const parts = url.pathname.split('/').filter(Boolean)
  const marker = parts[0]
  if (['embed', 'shorts', 'live'].includes(marker)) return parts[1] || ''
  return ''
}

export function videoSource(value) {
  if (!value || typeof value !== 'string') return null
  let url
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const host = url.hostname.replace(/^www\./, '')
  const youtube = youtubeId(url)
  if (youtube && /^[\w-]{6,}$/.test(youtube)) {
    return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtube)}`, shape: 'wide' }
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean).pop()
    if (id && /^\d+$/.test(id)) {
      return { kind: 'embed', src: `https://player.vimeo.com/video/${id}`, shape: 'wide' }
    }
  }

  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    const match = url.pathname.match(/\/video\/(\d+)/)
    if (match) return { kind: 'embed', src: `https://www.tiktok.com/embed/v2/${match[1]}`, shape: 'tall' }
    if (host === 'vt.tiktok.com' || host === 'vm.tiktok.com' || url.pathname.startsWith('/t/')) {
      return { kind: 'link', src: url.href, shape: 'tall' }
    }
  }

  if (host === 'instagram.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    if (['reel', 'p', 'tv'].includes(parts[0]) && parts[1]) {
      return { kind: 'embed', src: `https://www.instagram.com/${parts[0]}/${parts[1]}/embed`, shape: 'tall' }
    }
  }

  if (/\.(mp4|webm|ogg|ogv)(\?|$)/i.test(url.pathname)) {
    return { kind: 'file', src: url.href, shape: 'wide' }
  }

  return { kind: 'link', src: url.href, shape: 'wide' }
}
