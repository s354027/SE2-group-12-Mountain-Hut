
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
      window.dispatchEvent(new Event('mountainhut:tables-changed'));
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
      setError(`Table ${tableNumber} already exists. Please choose a different table number.`);
      return;
    }

    setSubmitting(true);
    try {
      if (editingId !== null) {
        const updated = await api.put(`/tables/${editingId}`, { tableNumber, seats });
        setTables((current) => current.map((table) => (table.id === editingId ? updated : table)));
      } else {
        const created = await api.post('/tables', { tableNumber, seats });
        setTables((current) => [...current, created]);
      }
      window.dispatchEvent(new Event('mountainhut:tables-changed'));
      cancelEdit();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="tables-manager">
      <div className="tables-manager-heading">
        <div>
          <span className="tables-manager-eyebrow">STAFF MANAGEMENT / DINING ROOM</span>
          <h2>Tables</h2>
          <p>Manage table numbers and seating capacity for the mountain hut.</p>
        </div>
        <span className="tables-manager-count">
          {tables.length} {tables.length === 1 ? 'table' : 'tables'}
        </span>
      </div>

      {loading && <p role="status">Loading tables...</p>}

      {!loading && (
        <ul className="tables-manager-list">
          {tables.map((table) => (
            <li key={table.id} className="tables-manager-card">
              <div className="tables-manager-card-info">
                <span className="tables-manager-card-number">
                  {String(table.tableNumber).padStart(2, '0')}
                </span>
                <div>
                  <strong>Table {table.tableNumber}</strong>
                  <span>
                    {table.seats} {table.seats === 1 ? 'seat' : 'seats'} available
                  </span>
                </div>
              </div>
              <div className="tables-manager-card-actions">
                <button
                  type="button"
                  className="btn-edit"
                  onClick={() => startEdit(table)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-delete"
                  onClick={() => handleDelete(table.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {tables.length === 0 && (
            <li className="tables-manager-empty">
              No tables yet. Add your first table below.
            </li>
          )}
        </ul>
      )}

      <form className="tables-manager-form" onSubmit={handleSubmit}>
        <div className="tables-manager-form-heading">
          <h3>{editingId !== null ? 'Edit table' : 'Add a new table'}</h3>
          <p>
            {editingId !== null
              ? 'Update the selected table details.'
              : 'Enter the table number and seating capacity.'}
          </p>
        </div>

        {error && (
          <div className="table-error-alert" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div className="tables-manager-form-grid">
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
        </div>

        <div className="tables-manager-form-actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : editingId !== null ? 'Save changes' : 'Add table'}
          </button>
          {editingId !== null && (
            <button
              type="button"
              className="btn-cancel"
              onClick={cancelEdit}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
