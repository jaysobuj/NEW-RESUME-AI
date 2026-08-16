// UpgradeModal.jsx - DEMO checkout for the Free -> Pro upgrade.
//
// This is a clearly-labelled FAKE payment form for a capstone project
// demo: it never contacts a real payment processor and accepts any
// card details. It exists to demonstrate the upgrade flow and its
// effect on AI credit quota, not to process real payments.

import React, { useState } from 'react';
import { Card, Alert } from './UI';
import api from '../services/api';

function formatCardNumber(v) {
  return v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(v) {
  const digits = v.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export default function UpgradeModal({ onClose, onSuccess }) {
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const res = await api.post('/billing/upgrade', { cardholderName, cardNumber, expiry, cvv });
      onSuccess(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not process demo payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}>
      <div style={{ maxWidth: 420, width: '90%' }} onClick={e => e.stopPropagation()}>
        <Card title="💳 Upgrade to Pro">
          <Alert type="warning" style={{ marginBottom: 14 }}>
            🧪 <strong>Demo payment form</strong> — this is a capstone project. No real payment processor is
            connected, nothing is charged, and any card details you enter (real or made up) will be accepted.
          </Alert>

          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Cardholder name</label>
              <input className="form-input" value={cardholderName} onChange={e => setCardholderName(e.target.value)}
                placeholder="Jane Doe" required />
            </div>
            <div className="form-group">
              <label className="form-label">Card number</label>
              <input className="form-input" value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="4242 4242 4242 4242" inputMode="numeric" required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Expiry (MM/YY)</label>
                <input className="form-input" value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))}
                  placeholder="12/28" inputMode="numeric" required />
              </div>
              <div className="form-group">
                <label className="form-label">CVV</label>
                <input className="form-input" value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="123" inputMode="numeric" required />
              </div>
            </div>

            {error && <Alert type="error">{error}</Alert>}

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? '⏳ Processing (demo)...' : '💳 Pay $12/mo (demo)'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
