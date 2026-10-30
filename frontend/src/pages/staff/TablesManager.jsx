import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const emptyForm = { tableNumber: '', seats: '' };

export default function TablesManager() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get('/tables')
      .then(setTables)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(table) {
    setEditingId(table.id);
    setForm({ tableNumber: String(table.tableNumber), seats: String(table.seats) });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleDelete(id) {
    try {
      await api.del(`/tables/${id}`);
      setTables((current) => current.filter((table) => table.id !== id));
      if (editingId === id) cancelEdit();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const tableNumber = Number(form.tableNumber);
    const seats = Number(form.seats);

    if (!Number.isInteger(tableNumber) || tableNumber < 1) {
      setError('Table number must be a positive integer');
      return;
    }
    if (!Number.isInteger(seats) || seats < 1) {
      setError('Seats must be a positive integer');
      return;
    }
    const isDuplicate = tables.some(
      (table) => table.tableNumber === tableNumber && table.id !== editingId,
    );
    if (isDuplicate) {
      setError('A table with this number already exists');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await api.put(`/tables/${editingId}`, { tableNumber, seats });
        setTables((current) => current.map((table) => (table.id === editingId ? updated : table)));
      } else {
        const created = await api.post('/tables', { tableNumber, seats });
        setTables((current) => [...current, created]);
      }
      cancelEdit();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2>Tables</h2>

      {loading && <p>Loading tables...</p>}
      {error && <p role="alert" className="form-error">{error}</p>}

      {!loading && (
        <ul>
          {tables.map((table) => (
            <li key={table.id}>
              Table {table.tableNumber} — {table.seats} seats{' '}
              <button type="button" onClick={() => startEdit(table)}>Edit</button>{' '}
              <button type="button" onClick={() => handleDelete(table.id)}>Delete</button>
            </li>
          ))}
          {tables.length === 0 && <li>No tables yet.</li>}
        </ul>
      )}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="tableNumber">Table number</label>
          <input
            id="tableNumber"
            type="number"
            min="1"
            value={form.tableNumber}
            onChange={(event) => setForm({ ...form, tableNumber: event.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="seats">Seats</label>
          <input
            id="seats"
            type="number"
            min="1"
            value={form.seats}
            onChange={(event) => setForm({ ...form, seats: event.target.value })}
            required
          />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : editingId ? 'Save changes' : 'Add table'}
        </button>
        {editingId && (
          <button type="button" onClick={cancelEdit} disabled={submitting}>
            Cancel
          </button>
        )}
      </form>
    </section>
  );
}
