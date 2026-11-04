import TablesManager from './staff/TablesManager.jsx';
import SlotsManager from './staff/SlotsManager.jsx';

export default function StaffSlots() {
  return (
    <section>
      <h1>Staff interface</h1>
      <TablesManager />
      <SlotsManager />
    </section>
  );
}