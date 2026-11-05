import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import "./SlotsManager.css";

const MEALS = ['LUNCH', 'DINNER'];
const STATUSES = ['OPEN', 'CLOSED'];

const EMPTY_FORM = {
  date: '',
  startTime: '',
  duration: '60', // minutes
  meal: 'LUNCH',
  status: 'OPEN',
  tableIds: [],
};

function validate(form) {
  if (!form.date) return 'Date is required.';
  if (!form.startTime) return 'Start time is required.';
  if (!MEALS.includes(form.meal)) return 'Meal must be LUNCH or DINNER.';
  if (!Number.isInteger(Number(form.duration)) || Number(form.duration) < 1) {
    return 'Duration must be a whole number of minutes (at least 1).';
  }
  if (!Array.isArray(form.tableIds) || form.tableIds.length === 0) {
    return 'Select at least one table.';
  }
  return '';
}


const selectStyle = { width: '100%', padding: '10px 12px', border: '1px solid #d3d9df', borderRadius: 6, fontSize: '1rem', background: '#fff' };

export default function SlotsManager() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); 
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [tables, setTables] = useState([]);
  const [tablesError, setTablesError] = useState('');

  async function loadSlots() {
    setLoading(true);
    setLoadError('');
    try {
      setSlots(await api.get('/slots'));
    } catch (err) {
      setLoadError(err.message || 'Could not load the slots.');
    } finally {
      setLoading(false);
    }
  }

  async function loadTables() {
    setTablesError('');

    try {
      setTables(await api.get('/tables'));
    } catch (err) {
      setTablesError(err.message || 'Could not load the tables.');
    }
  }

  useEffect(() => {
    loadSlots();
    loadTables();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEdit(slot) {
    setEditingId(slot.id);
    setForm({
      date: slot.date,
      startTime: String(slot.startTime).slice(0, 5), // "19:00:00" -> "19:00"
      duration: String(slot.duration),
      meal: slot.meal,
      status: slot.status,
      tableIds: (slot.tables || []).map((table) => table.id),
    });
    setFormError('');
    setMessage('');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    const problem = validate(form);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError('');

    const body = {
      date: form.date,
      startTime: form.startTime,
      duration: Number(form.duration),
      meal: form.meal,
      status: form.status,
      tableIds: form.tableIds,
    };

    setSaving(true);
    try {
      if (editingId === null) {
        await api.post('/slots', body);
        setMessage('Slot created.');
      } else {
        await api.put(`/slots/${editingId}`, body);
        setMessage('Slot updated.');
      }
      cancelEdit();
      await loadSlots();
    } catch (err) {
      setFormError(err.message || 'Could not save the slot.');
    } finally {
      setSaving(false);
    }
  }

  function handleTableChange(event) {
    const tableId = Number(event.target.value);

    setForm((current) => ({
      ...current,
      tableIds: event.target.checked ? [...current.tableIds, tableId] : current.tableIds.filter((id) => id !== tableId),
    }));
  }

  const selectedCapacity = tables
    .filter((table) => form.tableIds.includes(table.id))
    .reduce((sum, table) => sum + Number(table.seats), 0);

  return (
    <section aria-labelledby="slots-title">
      <h2 id="slots-title">Slots</h2>

      {loading && <p>Loading slots...</p>}
      {loadError && (
        <p role="alert" className="form-error">
          {loadError} <button type="button" onClick={loadSlots}>Retry</button>
        </p>
      )}
      {!loading && !loadError && slots.length === 0 && <p>No slots yet. Add the first one below.</p>}

      {slots.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {['Date', 'Start', 'Duration (min)', 'Meal', 'Capacity', 'Status', 'Tables', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ccc' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.id}>
                  <td style={{ padding: 8 }}>{slot.date}</td>
                  <td style={{ padding: 8 }}>{String(slot.startTime).slice(0, 5)}</td>
                  <td style={{ padding: 8 }}>{slot.duration}</td>
                  <td style={{ padding: 8 }}>{slot.meal}</td>
                  <td style={{ padding: 8 }}>{slot.totalCapacity}</td>
                  <td style={{ padding: 8 }}>{slot.status}</td>
                  <td style={{ padding: 8 }}>
                    {(slot.tables || []).map((t) => t.tableNumber).join(', ') || '-'}
                  </td>
                  <td style={{ padding: 8 }}>
                    <button className="btn-edit" onClick={() => startEdit(slot)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>{editingId === null ? 'Add a slot' : 'Edit the slot'}</h3>
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0 16px' }}>
          <div className="field">
            <label htmlFor="slot-date">Date</label>
            <input id="slot-date" type="date" name="date" value={form.date} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="slot-start">Start time</label>
            <input id="slot-start" type="time" name="startTime" value={form.startTime} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="slot-duration">Duration (minutes)</label>
            <input id="slot-duration" type="number" name="duration" min="1" value={form.duration} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="slot-meal">Meal</label>
            <select id="slot-meal" name="meal" value={form.meal} onChange={handleChange} style={selectStyle}>
              {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Tables</label>

            <div className="table-selection-grid">
              {tables.map((table) => {
                const selected = form.tableIds.includes(table.id);

                return (
                  <label
                    key={table.id}
                    className={`table-option ${selected ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      value={table.id}
                      checked={selected}
                      onChange={handleTableChange}
                    />

                    <div>
                      <strong>Table {table.tableNumber}</strong>
                      <span>{table.seats} seats</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="slot-capacity-summary">
            <span>Total capacity</span>
            <strong>{selectedCapacity} seats</strong>
          </div>
          <div className="field">
            <label htmlFor="slot-capacity">Total capacity (seats)</label>
            <input
              id="slot-capacity"
              type="number"
              value={selectedCapacity}
              readOnly
            />
          </div>
          <div className="field">
            <label htmlFor="slot-status">Status</label>
            <select id="slot-status" name="status" value={form.status} onChange={handleChange} style={selectStyle}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={saving}>
            {saving ? 'Saving...' : editingId === null ? 'Add slot' : 'Save changes'}
          </button>
          {editingId !== null && <button type="button" className="btn-cancel" onClick={cancelEdit} disabled={saving}>Cancel</button>}
        </div>
      </form>

      {formError && <p role="alert" className="form-error" style={{ marginTop: 16 }}>{formError}</p>}
      {message && <p role="status" style={{ color: '#166534' }}>{message}</p>}
    </section>
  );
}
