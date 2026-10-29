# Frontend (React + Vite)

## Run
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173  (/api is proxied to the backend on port 3000)
npm test         # unit tests (Vitest + Testing Library)
npm run build
```

## Structure
```
src/
  main.jsx            entry point (Router + AuthProvider)
  App.jsx             all routes
  api/client.js       ALL backend calls go through `api.get/post/put/del`
  auth/AuthContext.jsx  session: user, login(email, password), logout()
  components/         Layout (navbar), ProtectedRoute (role check)
  pages/              one file per page
tests/                tests (setup in tests/setup.js)
```

## Pages and owners
| Route | File | Task | Access |
|---|---|---|---|
| `/` | Home.jsx | - | public |
| `/login` | Login.jsx | MH-25 | public |
| `/search` | Search.jsx | MH-40 | public |
| `/booking` | Booking.jsx | MH-30, MH-31 | HIKER |
| `/staff/slots` | StaffSlots.jsx | MH-36 | EMPLOYEE, WARDEN |

## Rules
- Call the backend only through `src/api/client.js`.
- Roles are uppercase: `HIKER`, `EMPLOYEE`, `WARDEN` (not logged in = `user` is null).
- Login page: call `const { login } = useAuth(); await login(email, password)` (errors come as `Error.message`).
- Add a new page: create it in `pages/`, add a `<Route>` in `App.jsx`, and a link in `Layout.jsx` if needed.
