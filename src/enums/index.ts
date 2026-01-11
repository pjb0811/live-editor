import { type Section } from '../types';

export const CONFIG = {
  CACHE_LIMIT: 50,
} as const;

export const DATA_ATTR = {
  ID: 'data-id',
  BINDING: 'data-binding',
  ITEM: 'data-item',
} as const;

export const REGEX = {
  NUMBER: /^\d+(\.\d+)?$/,
  BOOLEAN_OR_NULL: /^(true|false|null|undefined)$/,
  CONTAINER: /(<main[^>]*id=["']app-container["'][^>]*>)([\s\S]*?)(<\/main>)/m,
  COMMENT: /\{\s*\/\*[\s\S]*?\*\/\s*\}/g,
  SECTION: /<section[\s\S]*?<\/section>/g,
  DATA_NAME: /data-name=["']([^"']+)["']/,
} as const;

export const TS_PATTERNS = [
  /interface\s+\w+/,
  /type\s+\w+\s*=/,
  /:\s*\w+(\[\])?(\s*\||\s*&|\s*=|\s*;|\s*,|\s*\))/,
  /as\s+\w+/,
  /<[A-Z]\w*>/,
  /enum\s+\w+/,
  /public\s+|private\s+|protected\s+/,
  /readonly\s+/,
  /\?\s*:/,
] as const;

export const BINDING_PROP = {
  CHILDREN: 'children',
  INNER_TEXT: 'innerText',
} as const;

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
        <ui.Space
          direction="vertical"
          size="middle"
          data-id=""
          data-binding={[
            {
              label: '버튼 구성',
              property: 'children',
            },
          ]}
        >
          <ui.Button
            variant="default"
            data-id=""
            data-binding={[
              { label: '문구', property: 'innerText' },
              { label: '스타일', property: 'variant' },
            ]}
          >
            Default Button
          </ui.Button>
          <ui.Button
            variant="outline"
            data-id=""
            data-binding={[
              { label: '문구', property: 'innerText' },
              { label: '스타일', property: 'variant' },
            ]}
          >
            Outline Button
          </ui.Button>
          <ui.Button variant="destructive">
            Destructive Button
          </ui.Button>
          <ui.Button variant="ghost">
            Ghost Button
          </ui.Button>
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
          <div
            className={cn(
              'rounded-lg border bg-card p-6 shadow-sm',
              'space-y-4',
            )}
            data-id=""
            data-binding={[
              { label: '카드 구성', property: 'children' },
            ]}
          >
            <h3
              className="text-lg font-semibold"
              data-id=""
              data-binding={[
                { label: '제목', property: 'innerText' },
              ]}
            >
              Card Title
            </h3>
            <p
              className="text-sm text-muted-foreground"
              data-id=""
              data-binding={[
                { label: '설명', property: 'innerText' },
              ]}
            >
              This is a card component example with some
              content.
            </p>
            <ui.Button
              variant="default"
              data-id=""
              data-binding={[
                { label: '버튼', property: 'innerText' },
              ]}
            >
              Action
            </ui.Button>
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
                data-id=""
                data-binding={[
                  { label: '제목', property: 'title' },
                  {
                    label: '확인 문구',
                    property: 'okText',
                  },
                  {
                    label: '취소 문구',
                    property: 'cancelText',
                  },
                  { label: '내용', property: 'children' },
                ]}
              >
                <p
                  data-id=""
                  data-binding={[
                    {
                      label: '내용 텍스트',
                      property: 'innerText',
                    },
                  ]}
                >
                  This is the modal content.
                </p>
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
                data-id=""
                data-binding={[
                  { label: '제목', property: 'title' },
                  { label: '내용', property: 'children' },
                ]}
              >
                <p
                  data-id=""
                  data-binding={[
                    {
                      label: '내용 텍스트',
                      property: 'innerText',
                    },
                  ]}
                >
                  This is the drawer content.
                </p>
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
        <ui.List
          title="List Title"
          data={[
            {
              id: 1,
              title: 'Item 1',
              description: 'Description for item 1',
            },
            {
              id: 2,
              title: 'Item 2',
              description: 'Description for item 2',
            },
            {
              id: 3,
              title: 'Item 3',
              description: 'Description for item 3',
            },
          ]}
          renderItem={item => (
            <ui.List.Item
              key={item.id}
              className="border-b p-4"
            >
              <h4 className="font-medium">{item.title}</h4>
              <p className="text-sm text-muted-foreground">
                {item.description}
              </p>
            </ui.List.Item>
          )}
          data-id=""
          data-binding={[
            { label: '제목', property: 'title' },
            { label: '목록', property: 'data' },
          ]}
        />
      </section>`,
  },
  {
    id: 'collapse-example',
    name: 'Collapse Example',
    code: `
      <section data-name="Collapse Example">
        <ui.Collapse
          items={[
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
          ]}
          defaultActiveKey={['1']}
          data-id=""
          data-binding={[
            {
              label: '항목 설정',
              property: 'items',
            },
          ]}
        />
      </section>`,
  },
  {
    id: 'progress-example',
    name: 'Progress Example',
    code: `
      <section data-name="Progress Example">
        <ui.Space direction="vertical" size="large">
          <ui.Progress
            value={10}
            data-id="h6gzcG"
            data-binding={[
              {
                label: '진행률',
                property: 'value',
              },
            ]}
          />
        </ui.Space>
      </section>`,
  },
  {
    id: 'switch-example',
    name: 'Switch Example',
    code: `
      <section data-name="Switch Example">
        {(() => {
          const [checked, setChecked] =
            React.useState(false);

          return (
            <ui.Space
              direction="horizontal"
              size="middle"
              align="center"
            >
              <span>Switch:</span>
              <ui.Switch
                checked={checked}
                onChange={setChecked}
              />
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
          const [loading, setLoading] =
            React.useState(true);
          React.useEffect(() => {
            const timer = setTimeout(
              () => setLoading(false),
              3000,
            );
            return () => clearTimeout(timer);
          }, []);
          return (
            <ui.Skeleton
              loading={loading}
              avatar
              active
              count={3}
              data-id="0czUka"
              data-binding={[
                {
                  label: '개수',
                  property: 'count',
                },
              ]}
            >
              <ui.Space direction="vertical" size="middle">
                <h3
                  className="text-lg font-semibold"
                  data-id="VBRvN8"
                  data-binding={[
                    {
                      label: '항목 제목',
                      property: 'innerText',
                    },
                  ]}
                >
                  Loaded Content11
                </h3>
                <p
                  data-id="lw9Ttp"
                  data-binding={[
                    {
                      label: '항목 설명',
                      property: 'innerText',
                    },
                  ]}
                >
                  This content appears after loading.22
                </p>
              </ui.Space>
            </ui.Skeleton>
          );
        })()}
      </section>`,
  },
];
