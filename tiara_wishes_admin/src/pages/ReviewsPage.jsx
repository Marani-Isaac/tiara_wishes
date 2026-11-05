import { useState } from 'react'
import { moderateReview } from '../api/reviews'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { FormField, PageHeader, SuccessNote } from '../components/common/States'

export default function ReviewsPage() {
  const [reviewId, setReviewId] = useState('')
  const [status, setStatus] = useState('approved')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setError('')
    try {
      const body = await moderateReview(reviewId, status)
      setNotice(body.message || `Review ${body.data?.id} is now ${body.data?.status}.`)
      setConfirm(false)
    } catch (err) {
      setError(err.message)
      setConfirm(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Moderation"
        title="Reviews"
        description="Only approved reviews are public. The API can update a review by id, and it does not yet provide a pending queue."
      />
      <SuccessNote>{notice}</SuccessNote>
      <form
        className="panel max-w-lg space-y-3 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          setConfirm(true)
        }}
      >
        <FormField id="review-id" label="Review id">
          <input id="review-id" className="field" inputMode="numeric" required value={reviewId} onChange={(event) => setReviewId(event.target.value)} />
        </FormField>
        <FormField id="review-status" label="Decision">
          <select id="review-status" className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="pending">Pending</option>
          </select>
        </FormField>
        {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
        <button className="btn btn-gold" type="submit">Review decision</button>
      </form>
      <ConfirmDialog
        open={confirm}
        title="Update this review?"
        body={`Set review ${reviewId} to ${status}. Shoppers only see approved reviews.`}
        confirmLabel="Save decision"
        busy={busy}
        onClose={() => setConfirm(false)}
        onConfirm={save}
      />
    </div>
  )
}
