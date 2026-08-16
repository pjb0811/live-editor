import { useNavigate } from 'react-router-dom';

import { Button, Space, Typography } from '@jbpark/ui-kit';
import { ExternalLink, SquarePlay } from 'lucide-react';

import { cn } from '~/utils';

// lucide-react removed all brand icons (including GitHub) in v1 — its own
// migration guide recommends a custom SVG in their place.
const GithubIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.04-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.71 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.44-2.7 5.42-5.27 5.7.41.36.78 1.07.78 2.15 0 1.56-.01 2.81-.01 3.19 0 .3.2.66.79.55A10.53 10.53 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
  </svg>
);

const HIGHLIGHTS = [
  {
    title: 'Editor Mode',
    description:
      'A code editor with a real-time preview, synced via AST transforms.',
    path: '/docs/editor-mode',
  },
  {
    title: 'Custom Editor',
    description:
      'Replace the built-in CodeMirror editor with your own editing surface via a render prop.',
    path: '/docs/editor-mode/custom-render',
  },
  {
    title: 'Drag & Drop',
    description:
      'Build UIs visually by dragging components onto a canvas and editing their properties from a side panel.',
    path: '/docs/dnd',
  },
  {
    title: 'Custom Palette & Panel',
    description:
      'Replace the built-in drag palette and property panel with your own markup via render props.',
    path: '/docs/dnd/custom-render',
  },
  {
    title: 'Preview Modes',
    description:
      'Render the live preview inside an isolated iframe or a shadow DOM host.',
    path: '/docs/preview-modes',
  },
];

const Overview = () => {
  const navigate = useNavigate();

  return (
    <Space orientation="vertical" size="large" className="w-full">
      <Space orientation="vertical" align="start">
        <Typography.Title level={1}>Live Editor</Typography.Title>
        <Typography.Paragraph className="text-lg text-gray-500">
          An interactive editor for building UIs with real-time preview and
          drag-and-drop. Canvas edits sync back to source code via AST
          transforms.
        </Typography.Paragraph>
      </Space>
      <Space align="start" wrap>
        <Button
          type="primary"
          size="large"
          icon={<SquarePlay />}
          onClick={() => navigate('/editor')}
        >
          Open Full Editor
        </Button>
        <Button
          size="large"
          icon={<GithubIcon size={16} />}
          onClick={() =>
            window.open('https://github.com/pjb0811/live-editor', '_blank')
          }
        >
          GitHub
        </Button>
        <Button
          size="large"
          icon={<ExternalLink />}
          onClick={() =>
            window.open(
              'https://www.npmjs.com/package/@jbpark/live-editor',
              '_blank',
            )
          }
        >
          npm
        </Button>
      </Space>

      <div className="grid gap-4 sm:grid-cols-2">
        {HIGHLIGHTS.map(item => (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            className={cn(
              'cursor-pointer rounded-lg border border-gray-200 p-4 text-left',
              'hover:border-blue-300 hover:shadow-md',
            )}
          >
            <Typography.Title level={4} className="mb-1">
              {item.title}
            </Typography.Title>
            <Typography.Paragraph className="text-sm text-gray-500">
              {item.description}
            </Typography.Paragraph>
          </button>
        ))}
      </div>
    </Space>
  );
};

export default Overview;
