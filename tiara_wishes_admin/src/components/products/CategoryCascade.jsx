import { useEffect, useState } from 'react'
import { FormField } from '../common/States'

const LABELS = ['Main category', 'Category', 'Subcategory', 'Child category']

function childrenOf(categories, parentId) {
  return categories.filter((item) => {
    if (!parentId) return !item.parent_id
    return Number(item.parent_id) === Number(parentId)
  })
}

function chainFor(categories, categoryId) {
  const byId = new Map(categories.map((item) => [Number(item.id), item]))
  const chain = []
  let current = byId.get(Number(categoryId))
  const seen = new Set()
  while (current && !seen.has(current.id) && chain.length < 4) {
    seen.add(current.id)
    chain.unshift(current)
    current = current.parent_id ? byId.get(Number(current.parent_id)) : null
  }
  return chain
}

export function categoryNeedsDeeper(categories, categoryId) {
  if (!categoryId) return false
  return childrenOf(categories, categoryId).length > 0
}

export default function CategoryCascade({ categories, categoryId, onChange, error }) {
  const [levels, setLevels] = useState(['', '', '', ''])

  useEffect(() => {
    if (!categoryId || categories.length === 0) {
      if (!categoryId) setLevels(['', '', '', ''])
      return
    }
    const chain = chainFor(categories, categoryId)
    const next = ['', '', '', '']
    chain.forEach((item, index) => {
      next[index] = String(item.id)
    })
    setLevels(next)
  }, [categoryId, categories])

  function choose(index, value) {
    const next = levels.slice()
    next[index] = value
    for (let cursor = index + 1; cursor < next.length; cursor += 1) next[cursor] = ''
    setLevels(next)
    const leaf = [...next].reverse().find(Boolean) || ''
    onChange(leaf)
  }

  const groups = [childrenOf(categories, null)]
  for (let index = 0; index < 3; index += 1) {
    groups.push(levels[index] ? childrenOf(categories, levels[index]) : [])
  }

  const names = levels
    .map((id) => categories.find((item) => String(item.id) === String(id))?.name)
    .filter(Boolean)

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {LABELS.map((label, index) => {
        const options = groups[index]
        if (index > 0 && options.length === 0) return null
        return (
          <FormField key={label} id={`category-level-${index}`} label={label} error={index === 0 ? error : ''}>
            <select
              id={`category-level-${index}`}
              className="field"
              value={levels[index]}
              onChange={(event) => choose(index, event.target.value)}
            >
              <option value="">{index === 0 ? 'Choose a main category' : 'Choose'}</option>
              {options.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.is_active === false ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </FormField>
        )
      })}
      {names.length ? (
        <p className="text-sm text-muted md:col-span-2">
          Shoppers see this path: {names.join(' / ')}
        </p>
      ) : (
        <p className="text-sm text-muted md:col-span-2">
          Pick the deepest level that exists. A product filed under a child category keeps the main category, category, and subcategory in its path.
        </p>
      )}
    </div>
  )
}
