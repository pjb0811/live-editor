import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Layout, Menu } from '@jbpark/ui-kit';

interface NavItem {
  key: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: '/', label: 'Overview' },
  { key: '/docs/editor-mode', label: 'Editor Mode' },
  { key: '/docs/dnd', label: 'Drag & Drop' },
  { key: '/docs/dnd/custom-render', label: 'Custom Palette & Panel' },
  { key: '/docs/preview-modes', label: 'Preview Modes' },
];

const DocsLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout className="min-h-screen">
      <Layout.Sider width={240} breakpoint="md" className="bg-gray-50">
        <div className="p-4">
          <span className="text-lg font-semibold">Live Editor</span>
        </div>
        <Menu
          mode="inline"
          items={NAV_ITEMS}
          selectedKeys={[location.pathname]}
          onSelect={({ key }) => navigate(String(key))}
        />
      </Layout.Sider>
      <Layout.Content className="overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </Layout.Content>
    </Layout>
  );
};

export default DocsLayout;
