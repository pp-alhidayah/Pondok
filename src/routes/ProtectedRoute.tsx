import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { authStore, AuthUser } from '../store/authStore';
import { MENU_CONFIG } from '../components/layout/menuConfig';

export const ProtectedRoute: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    authStore
      .getUser()
      .then((u) => {
        if (mounted) {
          setUser(u);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Route guard mengikuti hak akses menu. Contoh: /pengaturan hanya untuk
  // super_admin, sedangkan /santri/:id tetap mengikuti akses menu /santri.
  const menu = MENU_CONFIG.find(
    (item) =>
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`)
  );
  if (menu && !menu.roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
