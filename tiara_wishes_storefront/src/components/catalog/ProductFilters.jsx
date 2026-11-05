export function SortSelect({ value, onChange }) {
  return (
    <label className="text-sm font-semibold">
      <span className="sr-only">Sort</span>
      <select className="select min-w-40" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Sort products">
        <option value="newest">Newest</option>
        <option value="price_asc">Price, low to high</option>
        <option value="price_desc">Price, high to low</option>
        <option value="name">Name</option>
      </select>
    </label>
  )
}

function flatten(categories, depth = 0, list = []) {
  for (const category of categories || []) {
    list.push({ ...category, depth })
    flatten(category.children, depth + 1, list)
  }
  return list
}

export function ProductFilters({ categories, brands, filters, onChange }) {
  const flat = flatten(categories)
  function set(name, value) {
    onChange({ ...filters, [name]: value, page: 1 })
  }

  return (
    <form className="panel space-y-4 p-4" onSubmit={(event) => event.preventDefault()}>
      <p className="font-semibold">Filter</p>
      <label className="field-wrap">
        <span className="field-label">Category</span>
        <select className="select" value={filters.category} onChange={(event) => set('category', event.target.value)}>
          <option value="">All categories</option>
          {flat.map((category) => (
            <option key={category.id} value={category.slug}>
              {`${'— '.repeat(category.depth)}${category.name}`}
            </option>
          ))}
        </select>
      </label>
      <label className="field-wrap">
        <span className="field-label">Brand</span>
        <select className="select" value={filters.brand} onChange={(event) => set('brand', event.target.value)}>
          <option value="">All brands</option>
          {(brands || []).map((brand) => (
            <option key={brand.id} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field-wrap">
          <span className="field-label">Min price</span>
          <input className="field" inputMode="decimal" value={filters.min_price} onChange={(event) => set('min_price', event.target.value)} />
        </label>
        <label className="field-wrap">
          <span className="field-label">Max price</span>
          <input className="field" inputMode="decimal" value={filters.max_price} onChange={(event) => set('max_price', event.target.value)} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={filters.featured === '1'} onChange={(event) => set('featured', event.target.checked ? '1' : '')} />
        Featured only
      </label>
    </form>
  )
}
