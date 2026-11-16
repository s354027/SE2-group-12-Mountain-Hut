import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import './SlotsManager.css';


const MEALS = ['LUNCH', 'DINNER'];
const STATUSES = ['OPEN', 'CLOSED'];

const EMPTY_FORM = {
  date: '',
  startTime: '',
  duration: '60', // minutes
  meal: 'LUNCH',
  tableIds: [],
  status: 'OPEN',
};

function validate(form) {
  if (!form.date) return 'Date is required.';
  if (!form.startTime) return 'Start time is required.';
  if (!MEALS.includes(form.meal)) return 'Meal must be LUNCH or DINNER.';
  if (!Number.isInteger(Number(form.duration)) || Number(form.duration) < 1) {
    return 'Duration must be a whole number of minutes (at least 1).';
  }
  if (form.tableIds.length === 0) return 'Select at least one table.';
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
  const [copySourceId, setCopySourceId] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState('');

  const tablesDropdownRef = useRef(null);
  
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
    try {
      const updatedTables = await api.get('/tables');
      setTables(updatedTables);
      setTablesError('');
    } catch (err) {
      setTablesError(err.message || 'Could not load tables.');
    }
  }

  useEffect(() => {
    loadSlots();
    loadTables();

    function handleTablesChanged() {
      loadTables();
      loadSlots();
    }

    window.addEventListener('mountainhut:tables-changed', handleTablesChanged);
    return () => window.removeEventListener('mountainhut:tables-changed', handleTablesChanged);
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

 function startEdit(slot) {
  // Close the dropdown when switching to another slot
  if (tablesDropdownRef.current) {
    tablesDropdownRef.current.open = false;
  }

  setEditingId(slot.id);

  setForm({
    date: slot.date,
    startTime: String(slot.startTime).slice(0, 5),
    duration: String(slot.duration),
    meal: slot.meal,
    tableIds: (slot.tables || []).map((table) => Number(table.id)),
    status: slot.status,
  });

  setFormError('');
  setMessage('');
  setCopySourceId('');
  setCopyError('');
}

 function cancelEdit() {
  if (tablesDropdownRef.current) {
    tablesDropdownRef.current.open = false;
  }

  setEditingId(null);
  setForm(EMPTY_FORM);
  setFormError('');
  setCopySourceId('');
  setCopyError('');
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
      totalCapacity: selectedCapacity,
      tableIds: form.tableIds,
      status: form.status,
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

  const selectedTables = tables.filter((table) => form.tableIds.includes(Number(table.id)));
  const selectedCapacity = selectedTables.reduce((total, table) => total + Number(table.seats), 0);

  function toggleTable(tableId) {
    setForm((current) => ({
      ...current,
      tableIds: current.tableIds.includes(tableId)
        ? current.tableIds.filter((id) => id !== tableId)
        : [...current.tableIds, tableId],
    }));
  }

  const copySourceOptions = slots
    .filter((slot) => slot.id !== editingId && (slot.tables || []).length > 0)
    .slice()
    .sort((a, b) =>
      a.date === b.date
        ? String(b.startTime).localeCompare(String(a.startTime))
        : b.date.localeCompare(a.date),
    );

  async function copyTablesFromPreviousSlot() {
    if (!copySourceId) return;
    setCopyError('');
    setMessage('');

    // No slot id to call the copy-tables endpoint on yet; just prefill the
    // table selection locally from the already-loaded source slot.
    if (editingId === null) {
      const sourceSlot = slots.find((slot) => slot.id === Number(copySourceId));
      const sourceTables = sourceSlot?.tables || [];
      if (sourceTables.length === 0) {
        setCopyError('Selected source slot has no tables assigned.');
        return;
      }
      setForm((current) => ({
        ...current,
        tableIds: sourceTables.map((table) => Number(table.id)),
      }));
      setMessage('Tables copied from the selected slot.');
      return;
    }

    setCopying(true);
    try {
      const updatedSlot = await api.post(`/slots/${editingId}/copy-tables`, {
        sourceSlotId: Number(copySourceId),
      });
      setForm((current) => ({
        ...current,
        tableIds: (updatedSlot.tables || []).map((table) => Number(table.id)),
      }));
      setMessage('Tables copied from the selected slot.');
      await loadSlots();
    } catch (err) {
      setCopyError(err.message || 'Could not copy tables from that slot.');
    } finally {
      setCopying(false);
    }
  }

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
            <label htmlFor="slot-status">Status</label>
            <select id="slot-status" name="status" value={form.status} onChange={handleChange} style={selectStyle}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {copySourceOptions.length > 0 && (
          <div className="slot-copy-tables">
            <label htmlFor="copy-source-slot">Copy tables from previous slot</label>
            <div className="slot-copy-tables-controls">
              <select
                id="copy-source-slot"
                value={copySourceId}
                onChange={(event) => setCopySourceId(event.target.value)}
                style={selectStyle}
              >
                <option value="">Select a slot…</option>
                {copySourceOptions.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.date} · {String(slot.startTime).slice(0, 5)} · {slot.meal} (
                    {(slot.tables || []).map((table) => table.tableNumber).join(', ')})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary"
                onClick={copyTablesFromPreviousSlot}
                disabled={!copySourceId || copying}
              >
                {copying ? 'Copying...' : 'Copy'}
              </button>
            </div>
            {copyError && (
              <p role="alert" className="form-error">
                {copyError}
              </p>
            )}
          </div>
        )}
        <div className="slot-tables-section">
          <div className="slot-tables-heading">
            <label id="slot-tables-label">Tables</label>
            <span className="slot-capacity-value">Total capacity: <strong>{selectedCapacity} seats</strong></span>
          </div>
          {tablesError && <p role="alert" className="form-error">{tablesError}</p>}
          {!tablesError && tables.length === 0 && <p>No tables available. Add tables in the Tables manager first.</p>}
          {tables.length > 0 && (
       <details ref={tablesDropdownRef} className="slot-tables-dropdown">
              <summary aria-labelledby="slot-tables-label">
                {selectedTables.length === 0
                  ? 'Select tables'
                  : `${selectedTables.length} ${selectedTables.length === 1 ? 'table' : 'tables'} selected`}
              </summary>
              <div className="slot-tables-options">
                {tables.map((table) => (
                  <label key={table.id} className="slot-table-option">
                    <input
                      type="checkbox"
                      checked={form.tableIds.includes(Number(table.id))}
                      onChange={() => toggleTable(Number(table.id))}
                    />
                    <span>Table {table.tableNumber}</span>
                    <span className="slot-table-seats">{table.seats} seats</span>
                  </label>
                ))}
              </div>
            </details>
          )}
          {selectedTables.length > 0 && (
            <div className="slot-selected-tables" aria-label="Selected tables">
              {selectedTables.map((table) => (
                <span key={table.id} className="slot-table-chip">Table {table.tableNumber}</span>
              ))}
            </div>
          )}
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
