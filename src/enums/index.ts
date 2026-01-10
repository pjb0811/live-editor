import { type Section } from '../types';

export const DEFAULT_TEMPLATE = `
import * as ui from 'ui-kit';
import { cn } from 'ui-kit/utils';

const App = () => {
  return (
    <main id="app-container"></main>
  )
}

export default App;
`;

export const DRAGGABLE_ITEMS: Section[] = [
  {
    id: 'button-example',
    name: 'Button Example',
    code: `
      <section data-name="Button Example">
        <ui.Space direction="vertical" size="middle">
          <ui.Button variant="default">Default Button</ui.Button>
          <ui.Button variant="outline">Outline Button</ui.Button>
          <ui.Button variant="destructive">Destructive Button</ui.Button>
          <ui.Button variant="ghost">Ghost Button</ui.Button>
          <ui.Button loading>Loading Button</ui.Button>
        </ui.Space>
      </section>
    `,
  },
  {
    id: 'card-example',
    name: 'Card Example',
    code: `
      <section data-name="Card Example">
        <ui.Space direction="vertical" size="large">
          <div className={cn(
            "rounded-lg border bg-card p-6 shadow-sm",
            "space-y-4"
          )}>
            <h3 className="text-lg font-semibold">Card Title</h3>
            <p className="text-sm text-muted-foreground">
              This is a card component example with some content.
            </p>
            <ui.Button variant="default">Action</ui.Button>
          </div>
        </ui.Space>
      </section>
    `,
  },
  {
    id: 'modal-example',
    name: 'Modal Example',
    code: `
    <section data-name="Modal Example">
      {(() => {
        const [open, setOpen] = React.useState(false);

        return (
          <div>
            <ui.Button onClick={() => setOpen(true)}>
              Open Modal
            </ui.Button>
            <ui.Modal
              open={open}
              title="Modal Title"
              okText="Confirm"
              cancelText="Cancel"
              onOk={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            >
              <p>This is the modal content.</p>
            </ui.Modal>
          </div>
        );
      })()}
    </section>`,
  },
  {
    id: 'drawer-example',
    name: 'Drawer Example',
    code: `
      <section data-name="Drawer Example">
        {(() => {
          const [open, setOpen] = React.useState(false);

          return (
            <div>
              <ui.Button onClick={() => setOpen(true)}>
                Open Drawer
              </ui.Button>
              <ui.Drawer
                open={open}
                title="Drawer Title"
                direction="right"
                onClose={() => setOpen(false)}
              >
                <p>This is the drawer content.</p>
              </ui.Drawer>
            </div>
          );
        })()}
      </section>`,
  },
  {
    id: 'list-example',
    name: 'List Example',
    code: `
      <section data-name="List Example">
        {(() => {
          const data = [
            { id: 1, title: 'Item 1', description: 'Description for item 1' },
            { id: 2, title: 'Item 2', description: 'Description for item 2' },
            { id: 3, title: 'Item 3', description: 'Description for item 3' },
          ];

          return (
            <ui.List
              title="List Title"
              data={data}
              renderItem={(item) => (
                <ui.List.Item key={item.id} className="border-b p-4">
                  <h4 className="font-medium">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </ui.List.Item>
              )}
            />
          );
        })()}
      </section>`,
  },
  {
    id: 'collapse-example',
    name: 'Collapse Example',
    code: `
      <section data-name="Collapse Example">
        {(() => {
          const items = [
            {
              key: '1',
              label: 'Section 1',
              children: <p>Content for section 1</p>,
            },
            {
              key: '2',
              label: 'Section 2',
              children: <p>Content for section 2</p>,
            },
            {
              key: '3',
              label: 'Section 3',
              children: <p>Content for section 3</p>,
            },
          ];

          return <ui.Collapse items={items} defaultActiveKey={['1']} />;
        })()}
      </section>`,
  },
  {
    id: 'progress-example',
    name: 'Progress Example',
    code: `
      <section data-name="Progress Example">
        {(() => {
          const [value, setValue] = React.useState(0);

          React.useEffect(() => {
            const timer = setInterval(() => {
              setValue((prev) => (prev >= 100 ? 0 : prev + 10));
            }, 1000);
            return () => clearInterval(timer);
          }, []);

          return (
            <ui.Space direction="vertical" size="large">
              <ui.Progress value={value} />
              <ui.Progress value={value} direction="vertical" className="h-48" />
            </ui.Space>
          );
        })()}
      </section>`,
  },
  {
    id: 'checkbox-example',
    name: 'Checkbox Example',
    code: `
      <section data-name="Checkbox Example">
        {(() => {
          const [checked, setChecked] = React.useState(false);

          return (
            <ui.Space direction="vertical" size="middle">
              <ui.Checkbox
                checked={checked}
                onChange={setChecked}
              >
                Single Checkbox
              </ui.Checkbox>

              <ui.Checkbox.Group
                options={['Option 1', 'Option 2', 'Option 3']}
                direction="vertical"
                onChange={(values) => console.log(values)}
              />
            </ui.Space>
          );
        })()}
      </section>`,
  },
  {
    id: 'switch-example',
    name: 'Switch Example',
    code: `
      <section data-name="Switch Example">
        {(() => {
          const [checked, setChecked] = React.useState(false);

          return (
            <ui.Space direction="horizontal" size="middle" align="center">
              <span>Switch:</span>
              <ui.Switch checked={checked} onChange={setChecked} />
              <span>{checked ? 'On' : 'Off'}</span>
            </ui.Space>
          );
        })()}
      </section>
    `,
  },
  {
    id: 'skeleton-example',
    name: 'Skeleton Example',
    code: `
      <section data-name="Skeleton Example">
        {(() => {
          const [loading, setLoading] = React.useState(true);

          React.useEffect(() => {
            const timer = setTimeout(() => setLoading(false), 3000);
            return () => clearTimeout(timer);
          }, []);

          return (
            <ui.Skeleton loading={loading} avatar active count={3}>
              <ui.Space direction="vertical" size="middle">
                <h3 className="text-lg font-semibold">Loaded Content</h3>
                <p>This content appears after loading.</p>
              </ui.Space>
            </ui.Skeleton>
          );
        })()}
      </section>`,
  },
  {
    id: 'dropdown-example',
    name: 'Dropdown Example',
    code: `
      <section data-name="Dropdown Example">
        {(() => {
          const menu = {
            items: [
              { key: '1', label: 'Menu Item 1' },
              { key: '2', label: 'Menu Item 2' },
              { key: '3', label: 'Menu Item 3' },
            ],
            onClick: (key) => console.log('Clicked:', key),
          };

          return (
            <ui.Dropdown menu={menu} trigger="click">
              <ui.Button>Dropdown Menu</ui.Button>
            </ui.Dropdown>
          );
        })()}
      </section>`,
  },
];
