import { useEffect, useRef, useState } from 'react'

export default function SearchInput({ value, onChange, placeholder, label = 'Search' }) {
  const [text, setText] = useState(value || '')
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    setText(value || '')
  }, [value])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (text !== (value || '')) onChangeRef.current(text)
    }, 350)
    return () => clearTimeout(timer)
  }, [text, value])

  return (
    <label className="block min-w-[220px] flex-1">
      <span className="sr-only">{label}</span>
      <input
        className="field"
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
      />
    </label>
  )
}
