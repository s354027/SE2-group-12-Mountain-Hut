import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import StaffRegister from "./pages/StaffRegister.jsx";
import Search from "./pages/Search.jsx";
import Booking from "./pages/Booking.jsx";
import StaffSlots from "./pages/StaffSlots.jsx";
import StaffBooking from "./pages/StaffBooking.jsx";
import NotFound from "./pages/NotFound.jsx";
import BookingsPage from "./pages/hiker/BookingsPage.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

// One route per page. Each person fills in "their" page (see README).
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/search" element={<Search />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* any logged user */}
        <Route element={<ProtectedRoute />}>
          <Route path="/change-password" element={<ChangePassword />} />
        </Route>

        {/* hiker only */}
        <Route element={<ProtectedRoute roles={["HIKER"]} />}>
          <Route path="/booking" element={<Booking />} />
          <Route path="/bookings" element={<BookingsPage />} />
        </Route>

        {/* hut staff only */}
        <Route element={<ProtectedRoute roles={["EMPLOYEE", "WARDEN"]} />}>
          <Route path="/staff/slots" element={<StaffSlots />} />
          <Route path="/staff/bookings/new" element={<StaffBooking />} />
        </Route>

        {/* warden only */}
        <Route element={<ProtectedRoute roles={["WARDEN"]} />}>
          <Route path="/admin/staff/new" element={<StaffRegister />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
