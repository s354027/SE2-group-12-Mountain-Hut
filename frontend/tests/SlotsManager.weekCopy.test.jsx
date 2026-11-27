// MH-96: the "Repeat a weekly schedule" panel is shown only to employees
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: null }));
vi.mock("../src/auth/AuthContext.jsx", () => ({ useAuth: () => ({ user: auth.user }) }));

import SlotsManager from "../src/pages/staff/SlotsManager.jsx";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          url === "/api/slots"
            ? [{ id: 1, date: "2030-07-01", startTime: "12:00:00", duration: 60, meal: "LUNCH", totalCapacity: 4, status: "OPEN", tables: [] }]
            : [],
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("employees see the weekly copy panel", async () => {
  auth.user = { id: 1, role: "EMPLOYEE" };
  render(<SlotsManager />);
  expect(await screen.findByLabelText("Week to copy")).toBeInTheDocument();
});

test("wardens do not see the weekly copy panel", async () => {
  auth.user = { id: 2, role: "WARDEN" };
  render(<SlotsManager />);
  await screen.findByText(/No slots scheduled for this week|Slots/);
  expect(screen.queryByRole("heading", { name: "Repeat a weekly schedule" })).not.toBeInTheDocument();
});
