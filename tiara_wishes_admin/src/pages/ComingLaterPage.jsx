import { PageHeader } from '../components/common/States'

export default function ComingLaterPage() {
  return (
    <div>
      <PageHeader eyebrow="Roadmap" title="Chama" description="Coming later." />
      <div className="panel max-w-xl p-6">
        <p>
          Digital Chamas are not part of this release. There are no groups, contributions, rotations, allocations, or Chama payments to manage.
        </p>
      </div>
    </div>
  )
}
