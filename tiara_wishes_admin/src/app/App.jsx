import { BrowserRouter } from 'react-router-dom'
import { AdminAuthProvider } from '../context/AdminAuthContext'
import AppRoutes from './routes'

export default function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AdminAuthProvider>
  )
}
