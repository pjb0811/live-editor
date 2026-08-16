import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Button, Drawer, Layout, Menu } from '@jbpark/ui-kit';
import { Menu as MenuIcon } from 'lucide-react';

interface NavItem {
  key: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: '/', label: 'Overview' },
  { key: '/docs/editor-mode', label: 'Editor Mode' },
  { key: '/docs/editor-mode/custom-render', label: 'Custom Editor' },
  { key: '/docs/dnd', label: 'Drag & Drop' },
  { key: '/docs/dnd/custom-render', label: 'Custom Palette & Panel' },
  { key: '/docs/preview-modes', label: 'Preview Modes' },
];

const DocsLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleSelect = ({ key }: { key: React.Key }) => {
    navigate(String(key));
    setMobileNavOpen(false);
  };

  const nav = (
    <Menu
      className="w-full shadow-none"
      mode="vertical"
      items={NAV_ITEMS}
      selectedKeys={[location.pathname]}
      onSelect={handleSelect}
    />
  );

  return (
    <Layout className="min-h-screen">
      {/* `collapsedWidth={0}` instead of the default 80px icon rail — NAV_ITEMS
          has no icons, so an icon rail would just clip the full labels. The
          nav moves into the Drawer below once collapsed. */}
      <Layout.Sider
        width={240}
        collapsedWidth={0}
        breakpoint="md"
        collapsed={collapsed}
        onBreakpoint={setCollapsed}
        className="h-screen bg-gray-50"
      >
        <div className="p-4">
          <span className="block pb-4 text-lg font-semibold">Live Editor</span>
          {nav}
        </div>
      </Layout.Sider>
      <Layout.Content className="overflow-y-auto p-8">
        {collapsed && (
          <div className="mb-6 flex items-center justify-between">
            <span className="text-lg font-semibold">Live Editor</span>
            <Button
              shape="circle"
              icon={<MenuIcon />}
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            />
          </div>
        )}
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </Layout.Content>
      <Drawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        direction="left"
        size="75%"
        title="Live Editor"
      >
        {nav}
      </Drawer>
    </Layout>
  );
};

export default DocsLayout;
