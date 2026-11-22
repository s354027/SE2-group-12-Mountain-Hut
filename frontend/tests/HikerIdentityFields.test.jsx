import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import HikerIdentityFields from "../src/components/HikerIdentityFields.jsx";

function stubFetch(handler) {
  vi.stubGlobal("fetch", vi.fn(handler));
}

function jsonResponse(status, data) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function search(text) {
  fireEvent.change(screen.getByLabelText("Search by name, phone or email"), {
    target: { value: text },
  });
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
}

test("defaults to the existing-hiker tab", () => {
  render(<HikerIdentityFields value={null} onChange={vi.fn()} />);
  expect(screen.getByRole("tab", { name: "Existing hiker" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("does not search before the minimum query length", async () => {
  stubFetch(() => jsonResponse(200, []));
  render(<HikerIdentityFields value={null} onChange={vi.fn()} />);

  await search("a");

  expect(fetch).not.toHaveBeenCalled();
});

test("searches after the debounce and lets staff pick a result", async () => {
  const onChange = vi.fn();
  stubFetch((url) => {
    expect(url).toBe("/api/hikers/search?q=Anna");
    return jsonResponse(200, [
      { id: 7, firstName: "Anna", lastName: "Rossi", email: "anna@example.com", phone: null },
    ]);
  });
  render(<HikerIdentityFields value={null} onChange={onChange} />);

  await search("Anna");

  const result = await screen.findByRole("button", { name: /Anna Rossi/ });
  fireEvent.click(result);

  expect(onChange).toHaveBeenLastCalledWith({ mode: "EXISTING", id: 7 });
  expect(screen.getByText("anna@example.com")).toBeInTheDocument();
});

test("shows a message when no hiker matches the search", async () => {
  stubFetch(() => jsonResponse(200, []));
  render(<HikerIdentityFields value={null} onChange={vi.fn()} />);

  await search("Nobody");

  expect(await screen.findByText('No hiker found for "Nobody".')).toBeInTheDocument();
});

test("surfaces a search error from the API", async () => {
  stubFetch(() => jsonResponse(500, { error: "Unable to search hikers" }));
  render(<HikerIdentityFields value={null} onChange={vi.fn()} />);

  await search("Anna");

  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to search hikers");
});

test("switching mode clears the current selection", () => {
  const onChange = vi.fn();
  render(<HikerIdentityFields value={null} onChange={onChange} />);

  fireEvent.click(screen.getByRole("tab", { name: "New hiker account" }));

  expect(onChange).toHaveBeenLastCalledWith(null);
  expect(screen.getByRole("tab", { name: "New hiker account" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("emits a FULL hiker payload only once every required field is valid", () => {
  const onChange = vi.fn();
  render(<HikerIdentityFields value={null} onChange={onChange} />);
  fireEvent.click(screen.getByRole("tab", { name: "New hiker account" }));
  onChange.mockClear();

  fireEvent.change(screen.getByLabelText("First name *"), { target: { value: "Anna" } });
  fireEvent.change(screen.getByLabelText("Last name *"), { target: { value: "Rossi" } });
  expect(onChange).toHaveBeenLastCalledWith(null);

  fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "not-an-email" } });
  expect(onChange).toHaveBeenLastCalledWith(null);
  expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "anna@example.com" } });
  fireEvent.change(screen.getByLabelText("Mobile number *"), { target: { value: "3331234567" } });

  expect(onChange).toHaveBeenLastCalledWith({
    mode: "FULL",
    firstName: "Anna",
    lastName: "Rossi",
    email: "anna@example.com",
    phone: "3331234567",
  });

  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Vegetarian" } });
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "FULL",
    firstName: "Anna",
    lastName: "Rossi",
    email: "anna@example.com",
    phone: "3331234567",
    notes: "Vegetarian",
  });
});

test("emits a QUICK hiker payload from just a first name, including optional fields once filled", () => {
  const onChange = vi.fn();
  render(<HikerIdentityFields value={null} onChange={onChange} />);
  fireEvent.click(screen.getByRole("tab", { name: "Quick entry" }));
  onChange.mockClear();

  fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "Luca" } });
  expect(onChange).toHaveBeenLastCalledWith({ mode: "QUICK", firstName: "Luca" });

  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "3339876543" } });
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "QUICK",
    firstName: "Luca",
    phone: "3339876543",
  });
});

test("allows changing a selected existing hiker back to a new search", async () => {
  const onChange = vi.fn();
  stubFetch(() =>
    jsonResponse(200, [{ id: 3, firstName: "Mario", lastName: "Bianchi", email: null, phone: "333" }]),
  );
  render(<HikerIdentityFields value={null} onChange={onChange} />);

  await search("Mario");
  fireEvent.click(await screen.findByRole("button", { name: /Mario Bianchi/ }));
  onChange.mockClear();

  fireEvent.click(screen.getByRole("button", { name: "Change" }));

  expect(onChange).toHaveBeenLastCalledWith(null);
  expect(screen.getByLabelText("Search by name, phone or email")).toHaveValue("");
});
