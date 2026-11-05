import { useParams } from 'react-router-dom'
import Catalogue from './Catalogue'

export default function ShopPage() {
  return <Catalogue />
}

export function CategoryPage() {
  const { slug } = useParams()
  return <Catalogue categorySlug={slug} />
}
