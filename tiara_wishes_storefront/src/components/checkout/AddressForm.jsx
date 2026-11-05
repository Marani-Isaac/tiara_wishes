import { COUNTIES } from '../../data/counties'
import { Field } from '../common/Button'

const empty = {
  recipient_name: '',
  recipient_phone: '',
  county: 'Nairobi',
  town: '',
  area_or_estate: '',
  building: '',
  house_or_unit: '',
  delivery_instructions: '',
}

export { empty as emptyAddress }

export default function AddressForm({ value, onChange, errors = {}, idPrefix = 'address' }) {
  function set(name, next) {
    onChange({ ...value, [name]: next })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={`${idPrefix}-name`} label="Recipient name" value={value.recipient_name} error={errors.recipient_name} onChange={(event) => set('recipient_name', event.target.value)} />
      <Field id={`${idPrefix}-phone`} label="Recipient phone" value={value.recipient_phone} hint="Kenyan number, for the delivery contact." error={errors.recipient_phone} onChange={(event) => set('recipient_phone', event.target.value)} />
      <Field id={`${idPrefix}-county`} label="County" as="select" value={value.county} error={errors.county} onChange={(event) => set('county', event.target.value)}>
        {COUNTIES.map((county) => (
          <option key={county} value={county}>
            {county}
          </option>
        ))}
      </Field>
      <Field id={`${idPrefix}-town`} label="Town" value={value.town} error={errors.town} onChange={(event) => set('town', event.target.value)} />
      <Field id={`${idPrefix}-area`} label="Area or estate" value={value.area_or_estate} error={errors.area_or_estate} onChange={(event) => set('area_or_estate', event.target.value)} />
      <Field id={`${idPrefix}-building`} label="Building" value={value.building} error={errors.building} onChange={(event) => set('building', event.target.value)} />
      <Field id={`${idPrefix}-unit`} label="House or unit" value={value.house_or_unit} error={errors.house_or_unit} onChange={(event) => set('house_or_unit', event.target.value)} />
      <div className="sm:col-span-2">
        <Field id={`${idPrefix}-notes`} as="textarea" label="Delivery instructions" value={value.delivery_instructions} error={errors.delivery_instructions} onChange={(event) => set('delivery_instructions', event.target.value)} />
      </div>
    </div>
  )
}

export function CheckoutSteps({ step }) {
  const steps = ['Account', 'Delivery', 'Review']
  return (
    <ol className="steps mb-6">
      {steps.map((label, index) => {
        const number = index + 1
        const state = number === step ? 'active' : number < step ? 'done' : ''
        return (
          <li key={label} className={`step ${state}`}>
            <span className="step-index">{number}</span>
            {label}
          </li>
        )
      })}
    </ol>
  )
}
