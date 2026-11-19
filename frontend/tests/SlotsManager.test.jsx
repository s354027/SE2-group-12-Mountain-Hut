import { render, screen, waitFor, within } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import SlotsManager from "../src/pages/staff/SlotsManager.jsx";

const TABLES = [
  { id: 1, tableNumber: 1, seats: 4 },
  { id: 2, tableNumber: 2, seats: 2 },
];

// Always within the calendar's default "current week" view, regardless of
// which day the suite happens to run on.
function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const SOURCE_SLOT = {
  id: 10,
  date: todayISO(),
  startTime: "12:00:00",
  duration: 60,
  meal: "LUNCH",
  totalCapacity: 4,
  status: "OPEN",
  tables: [TABLES[0]],
};

function jsonResponse(status, data) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
}

function stubFetch(extra = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url, options = {}) => {
      const method = options.method || "GET";

      if (url === "/api/slots" && method === "GET") {
        return jsonResponse(200, [SOURCE_SLOT]);
      }
      if (url === "/api/tables" && method === "GET") {
        return jsonResponse(200, TABLES);
      }
      if (extra[`${method} ${url}`]) {
        return extra[`${method} ${url}`](options);
      }
      if (url === "/api/slots" && method === "POST") {
        return jsonResponse(201, { id: 99, tables: [] });
      }

      throw new Error(`Unhandled request: ${method} ${url}`);
    }),
  );
}

beforeEach(() => {
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function waitForSlotsLoaded() {
  await screen.findByLabelText("Copy tables from previous slot");
}

async function copyFromSourceSlot() {
  fireEvent.change(screen.getByLabelText("Copy tables from previous slot"), {
    target: { value: String(SOURCE_SLOT.id) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  await screen.findByText("Tables copied from the selected slot.");
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2030-12-05" } });
  fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "19:00" } });
}

test("copying in Add mode prefills the selection locally, without calling the copy-tables endpoint", async () => {
  render(<SlotsManager />);
  await waitForSlotsLoaded();

  await copyFromSourceSlot();

  const selected = screen.getByLabelText("Selected tables");
  expect(within(selected).getByText("Table 1")).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalledWith(
    expect.stringContaining("/copy-tables"),
    expect.anything(),
  );
});

test("submitting right after a copy sends the copied table list as an explicit snapshot", async () => {
  stubFetch({
    "POST /api/slots": () => jsonResponse(201, { id: 99, tables: [TABLES[0]] }),
  });
  render(<SlotsManager />);
  await waitForSlotsLoaded();

  await copyFromSourceSlot();
  fillRequiredFields();
  fireEvent.click(screen.getByRole("button", { name: "Add slot" }));

  await waitFor(() => {
    const call = fetch.mock.calls.find(([url, options]) => url === "/api/slots" && options.method === "POST");
    expect(call).toBeTruthy();
  });

  const [, options] = fetch.mock.calls.find(
    ([url, requestOptions]) => url === "/api/slots" && requestOptions.method === "POST",
  );
  const body = JSON.parse(options.body);
  expect(body).not.toHaveProperty("sourceSlotId");
  expect(body.tableIds).toEqual([TABLES[0].id]);
});

test("the copied table selection can still be edited before submitting", async () => {
  stubFetch({
    "POST /api/slots": () => jsonResponse(201, { id: 99, tables: [TABLES[0], TABLES[1]] }),
  });
  render(<SlotsManager />);
  await waitForSlotsLoaded();

  await copyFromSourceSlot();

  fireEvent.click(screen.getByRole("checkbox", { name: /Table 2/ }));

  fillRequiredFields();
  fireEvent.click(screen.getByRole("button", { name: "Add slot" }));

  await waitFor(() => {
    const call = fetch.mock.calls.find(([url, options]) => url === "/api/slots" && options.method === "POST");
    expect(call).toBeTruthy();
  });

  const [, options] = fetch.mock.calls.find(
    ([url, requestOptions]) => url === "/api/slots" && requestOptions.method === "POST",
  );
  const body = JSON.parse(options.body);
  expect(body.tableIds.slice().sort()).toEqual([1, 2]);
});

test("copying while editing an existing slot still goes through the copy-tables endpoint", async () => {
  const otherSlot = { ...SOURCE_SLOT, id: 11, startTime: "19:00:00", tables: [TABLES[1]] };
  vi.stubGlobal(
    "fetch",
    vi.fn((url, options = {}) => {
      const method = options.method || "GET";
      if (url === "/api/slots" && method === "GET") {
        return jsonResponse(200, [SOURCE_SLOT, otherSlot]);
      }
      if (url === "/api/tables" && method === "GET") {
        return jsonResponse(200, TABLES);
      }
      if (url === `/api/slots/${SOURCE_SLOT.id}/copy-tables` && method === "POST") {
        return jsonResponse(200, { ...SOURCE_SLOT, tables: [TABLES[1]] });
      }
      throw new Error(`Unhandled request: ${method} ${url}`);
    }),
  );

  render(<SlotsManager />);
  await waitForSlotsLoaded();

  const rows = await screen.findAllByRole("row");
  const sourceSlotRow = rows.find((row) => within(row).queryByText("12:00"));
  fireEvent.click(within(sourceSlotRow).getByRole("button", { name: "Edit" }));

  fireEvent.change(screen.getByLabelText("Copy tables from previous slot"), {
    target: { value: String(otherSlot.id) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith(
      `/api/slots/${SOURCE_SLOT.id}/copy-tables`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  const [, options] = fetch.mock.calls.find(
    ([callUrl]) => callUrl === `/api/slots/${SOURCE_SLOT.id}/copy-tables`,
  );
  expect(JSON.parse(options.body)).toEqual({ sourceSlotId: otherSlot.id });
});
