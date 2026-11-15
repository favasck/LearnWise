import React from 'react';
import { Modal } from '../ui';

const amount=value=>new Intl.NumberFormat('en-QA',{style:'currency',currency:'QAR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0));
export default function InvoiceDetails({invoice,onClose}) {
  return <Modal title={`Invoice ${invoice.invoice_number || 'details'}`} onClose={onClose}>
    <p className="experience-explainer">Check the learner, period and recorded balance below. For a correction or a breakdown of covered lessons, contact the academy with this invoice number.</p>
    <dl className="review">{[
      ['Student',invoice.student?.full_name || 'Family account'],
      ['Status',invoice.status || 'Not specified'],
      ['Period',invoice.period_start?`${invoice.period_start} to ${invoice.period_end || 'not specified'}`:'Not specified'],
      ['Due date',invoice.due_date || 'Not specified'],
      ['Total billed',amount(invoice.total_qar)],
      ['Recorded as paid',amount(invoice.paid_qar)],
      ['Balance remaining',amount(invoice.balance_qar)],
    ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {invoice.notes&&<div><h3>Invoice notes</h3><p style={{whiteSpace:'pre-wrap'}}>{invoice.notes}</p></div>}
    <p className="field__hint">Payment history lists the payments recorded for your account. This summary does not initiate a payment.</p>
  </Modal>;
}
