// MH-96: frontend for MH-09 Repeat a weekly schedule
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import WeekCopyPanel, { weekLabel } from "../src/pages/staff/WeekCopyPanel.jsx";
import { addDays, dateKey, startOfWeek } from "../src/pages/staff/weekDates.js";

// Dates relative to today so the suite never ages
const today = new Date();
const currentMonday = startOfWeek(today);
const firstTarget = dateKey(currentMonday) === dateKey(today) ? currentMonday : addDays(currentMonday, 7);
const PAST_WEEK = dateKey(addDays(currentMonday, -7));
const FIRST_TARGET = dateKey(firstTarget);
const TARGET_EMPTY = dateKey(addDays(firstTarget, 7));
const TARGET_WITH_SLOTS = dateKey(addDays(firstTarget, 14));
const TARGET_BOOKED = dateKey(addDays(firstTarget, 21));

const SLOTS = [
  { id: 1, date: PAST_WEEK, startTime: "12:00:00", meal: "LUNCH", totalCapacity: 10 },
  { id: 2, date: PAST_WEEK, startTime: "19:30:00", meal: "DINNER", totalCapacity: 12 },
  { id: 3, date: dateKey(addDays(currentMonday, -3)), startTime: "12:30:00", meal: "LUNCH", totalCapacity: 8 },
  { id: 4, date: dateKey(addDays(firstTarget, 16)), startTime: "12:00:00", meal: "LUNCH", totalCapacity: 6, activeBookingCount: 0 }, // only cancelled bookings
  { id: 5, date: dateKey(addDays(firstTarget, 22)), startTime: "12:00:00", meal: "LUNCH", totalCapacity: 6, activeBookingCount: 2 },
];

function jsonResponse(status, data) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => data });
}

function copyResult(weeks) {
  return {
    sourceWeekStart: PAST_WEEK,
    weeks: weeks.map(([weekStart, replacedSlots]) => ({
      weekStart,
      replacedSlots,
      createdSlots: [{ id: 50 }, { id: 51 }, { id: 52 }],
    })),
  };
}

let onCopied;

beforeEach(() => {
  onCopied = vi.fn();
  vi.stubGlobal("fetch", vi.fn(() => jsonResponse(201, copyResult([[TARGET_EMPTY, 0]]))));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPanel(slots = SLOTS) {
  render(<WeekCopyPanel slots={slots} onCopied={onCopied} />);
}

function selectSource(week = PAST_WEEK) {
  fireEvent.change(screen.getByLabelText("Week to copy"), { target: { value: week } });
}

function targetCheckbox(week) {
  return screen.getByRole("checkbox", { name: new RegExp(`^${weekLabel(week)}`) });
}

function summary() {
  return screen.getByText(/^(Choose|You are copying)/);
}

function postedBody() {
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe("/api/slots/copy-week");
  expect(options.method).toBe("POST");
  return JSON.parse(options.body);
}

test("explains how the feature works and shows a hint when there are no slots", () => {
  renderPanel([]);
  expect(screen.getByLabelText("How it works")).toHaveTextContent("completely replaced");
  expect(screen.getByText(/There are no slots to copy yet/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Week to copy")).not.toBeInTheDocument();
});

test("guides the employee through three steps", () => {
  renderPanel();
  expect(screen.getByText("Step 1 – Choose the week to copy")).toBeInTheDocument();
  expect(screen.getByText("Step 2 – Choose the target weeks")).toBeInTheDocument();
  expect(screen.getByText("Step 3 – Review and copy")).toBeInTheDocument();
  expect(screen.getByText("Select a week to copy first.")).toBeInTheDocument();
  expect(summary()).toHaveTextContent("Choose the week to copy (step 1).");
  expect(screen.getByRole("button", { name: "Copy week" })).toBeDisabled();
});

test("source weeks are only weeks with slots, in ascending order", () => {
  renderPanel();
  const options = within(screen.getByLabelText("Week to copy")).getAllByRole("option").slice(1);
  expect(options.map((o) => o.value)).toEqual([PAST_WEEK, TARGET_WITH_SLOTS, TARGET_BOOKED]);
  expect(options[0]).toHaveTextContent("(3 slots)");
});

test("previews the slots of the chosen week", () => {
  renderPanel();
  selectSource();
  const preview = screen.getByLabelText("Slots that will be copied");
  expect(preview).toHaveTextContent("12:00 Lunch (10 seats), 19:30 Dinner (12 seats)");
  expect(preview).toHaveTextContent("12:30 Lunch (8 seats)");
  expect(within(preview).getAllByRole("listitem")).toHaveLength(2);
});

test("target weeks exclude the source and weeks already started, with clear tags", () => {
  renderPanel();
  selectSource(TARGET_WITH_SLOTS);

  const targets = within(screen.getByRole("group", { name: "Copy to" })).getAllByRole("checkbox");
  expect(targets).toHaveLength(11);
  expect(screen.queryByRole("checkbox", { name: new RegExp(`^${weekLabel(TARGET_WITH_SLOTS)}`) })).toBeNull();
  if (dateKey(currentMonday) !== dateKey(today)) {
    expect(screen.queryByRole("checkbox", { name: new RegExp(`^${weekLabel(dateKey(currentMonday))}`) })).toBeNull();
  }
  expect(targetCheckbox(TARGET_EMPTY)).toHaveAccessibleName(expect.stringContaining("Empty"));
});

test("Clear empties the selection of target weeks", () => {
  renderPanel();
  selectSource();
  expect(summary()).toHaveTextContent("Choose at least one target week (step 2).");
  expect(screen.queryByRole("button", { name: /Select next/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();

  fireEvent.click(targetCheckbox(FIRST_TARGET));
  fireEvent.click(targetCheckbox(TARGET_WITH_SLOTS));
  expect(summary()).toHaveTextContent(`You are copying 3 slots from ${weekLabel(PAST_WEEK)} to 2 weeks.`);
  expect(summary()).toHaveTextContent("1 week already has a schedule and will be replaced.");
  expect(screen.getByRole("button", { name: "Copy to 2 weeks" })).toBeEnabled();

  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(targetCheckbox(FIRST_TARGET)).not.toBeChecked();
  expect(targetCheckbox(TARGET_WITH_SLOTS)).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Copy week" })).toBeDisabled();
});

test("weeks with bookings are tagged in red and cannot be selected", () => {
  renderPanel();
  selectSource();

  const booked = targetCheckbox(TARGET_BOOKED);
  expect(booked).toHaveAccessibleName(expect.stringContaining("Has bookings"));
  expect(booked).toBeDisabled();
  expect(booked.closest("label")).toHaveAttribute("title", "This week has reservations and cannot be replaced");
  expect(screen.getByText("Has bookings")).toHaveClass("week-copy-tag-booked");

  fireEvent.click(booked);
  expect(booked).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Copy week" })).toBeDisabled();

  // a week with slots and only cancelled bookings can still be replaced
  expect(targetCheckbox(TARGET_WITH_SLOTS)).toBeEnabled();
  expect(targetCheckbox(TARGET_WITH_SLOTS)).toHaveAccessibleName(expect.stringContaining("will be replaced"));
});

test("copies onto an empty week without confirmation and shows the result", async () => {
  renderPanel();
  selectSource();
  fireEvent.click(targetCheckbox(TARGET_EMPTY));
  expect(summary()).toHaveTextContent(`You are copying 3 slots from ${weekLabel(PAST_WEEK)} to 1 week.`);
  fireEvent.click(screen.getByRole("button", { name: "Copy to 1 week" }));

  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent("Schedule copied to 1 week:");
  expect(status).toHaveTextContent(`${weekLabel(TARGET_EMPTY)}: 3 slots created`);
  expect(status).toHaveTextContent("now in the calendar above");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(postedBody()).toEqual({ sourceWeekStart: PAST_WEEK, targetWeekStarts: [TARGET_EMPTY] });
  expect(onCopied).toHaveBeenCalledOnce();
  expect(targetCheckbox(TARGET_EMPTY)).not.toBeChecked();
});

test("asks for confirmation before replacing an existing schedule", async () => {
  fetch.mockImplementation(() =>
    jsonResponse(201, copyResult([[TARGET_EMPTY, 0], [TARGET_WITH_SLOTS, 1]])),
  );
  renderPanel();
  selectSource();
  expect(screen.getByText("1 slot – will be replaced")).toBeInTheDocument();

  fireEvent.click(targetCheckbox(TARGET_WITH_SLOTS));
  fireEvent.click(targetCheckbox(TARGET_EMPTY));
  fireEvent.click(screen.getByRole("button", { name: "Copy to 2 weeks" }));

  const dialog = screen.getByRole("alertdialog");
  expect(dialog).toHaveTextContent("will be completely replaced");
  expect(dialog).toHaveTextContent("This cannot be undone");
  expect(within(dialog).getByText(`${weekLabel(TARGET_WITH_SLOTS)} (1 slot)`)).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole("button", { name: "Replace and copy" }));

  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent("Schedule copied to 2 weeks");
  expect(status).toHaveTextContent("1 old slot replaced");
  // weeks are sent in chronological order
  expect(postedBody().targetWeekStarts).toEqual([TARGET_EMPTY, TARGET_WITH_SLOTS]);
});

test("cancelling the confirmation sends no request", () => {
  renderPanel();
  selectSource();
  fireEvent.click(targetCheckbox(TARGET_WITH_SLOTS));
  fireEvent.click(screen.getByRole("button", { name: "Copy to 1 week" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  expect(targetCheckbox(TARGET_WITH_SLOTS)).toBeChecked();
});

test("explains what to do when a target week has reservations", async () => {
  const error = `Target week starting ${TARGET_WITH_SLOTS} has bookings and cannot be replaced`;
  fetch.mockImplementation(() => jsonResponse(409, { error }));
  renderPanel();
  selectSource();
  fireEvent.click(targetCheckbox(TARGET_WITH_SLOTS));
  fireEvent.click(screen.getByRole("button", { name: "Copy to 1 week" }));
  fireEvent.click(screen.getByRole("button", { name: "Replace and copy" }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(error);
  expect(alert).toHaveTextContent("Nothing was copied. Remove that week from the selection");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(onCopied).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Copy to 1 week" })).toBeEnabled());
});

test("shows other backend errors without the reservations hint", async () => {
  fetch.mockImplementation(() => jsonResponse(400, { error: "Source week has no slots to copy" }));
  renderPanel();
  selectSource();
  fireEvent.click(targetCheckbox(TARGET_EMPTY));
  fireEvent.click(screen.getByRole("button", { name: "Copy to 1 week" }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Source week has no slots to copy");
  expect(alert).not.toHaveTextContent("Nothing was copied");
});
