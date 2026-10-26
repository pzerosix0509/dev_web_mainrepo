import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { HomePage } from '../features/home/HomePage';
import { MenuPage } from '../features/menu/MenuPage';
import { DishDetailPage } from '../features/menu/DishDetailPage';
import { EntityPage } from '../features/admin/EntityPage';
import { EntityFormPage } from '../features/admin/EntityFormPage';
import { DishesPage } from '../features/admin/DishesPage';
import { DishFormPage } from '../features/admin/DishFormPage';
import { AdminDetailPage } from '../features/admin/AdminDetailPage';
import { DeleteConfirmPage } from '../features/admin/DeleteConfirmPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },

      // Public routes
      { path: 'dishes', element: <MenuPage /> },
      { path: 'dishes/:id', element: <DishDetailPage /> },
      { path: 'menu', element: <MenuPage /> },
      { path: 'menu/:id', element: <DishDetailPage /> },

      // Admin Dishes
      { path: 'admin/dishes', element: <DishesPage /> },
      { path: 'admin/dishes/new', element: <DishFormPage /> },
      { path: 'admin/dishes/:id', element: <AdminDetailPage kind="dishes" /> },
      { path: 'admin/dishes/:id/edit', element: <DishFormPage /> },
      { path: 'admin/dishes/:id/delete', element: <DeleteConfirmPage kind="dishes" /> },

      // Admin Chefs
      { path: 'admin/chefs', element: <EntityPage kind="chefs" /> },
      { path: 'admin/chefs/new', element: <EntityFormPage kind="chefs" /> },
      { path: 'admin/chefs/:id', element: <AdminDetailPage kind="chefs" /> },
      { path: 'admin/chefs/:id/edit', element: <EntityFormPage kind="chefs" /> },
      { path: 'admin/chefs/:id/delete', element: <DeleteConfirmPage kind="chefs" /> },

      // Admin Ingredients
      { path: 'admin/ingredients', element: <EntityPage kind="ingredients" /> },
      { path: 'admin/ingredients/new', element: <EntityFormPage kind="ingredients" /> },
      { path: 'admin/ingredients/:id', element: <AdminDetailPage kind="ingredients" /> },
      { path: 'admin/ingredients/:id/edit', element: <EntityFormPage kind="ingredients" /> },
      { path: 'admin/ingredients/:id/delete', element: <DeleteConfirmPage kind="ingredients" /> },

      // Fallback
      {
        path: '*',
        element: (
          <section className="page">
            <h1>404</h1>
            <p>Trang không tồn tại.</p>
          </section>
        )
      }
    ]
  }
]);
