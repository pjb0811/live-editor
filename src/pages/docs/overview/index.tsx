import { useNavigate } from 'react-router-dom';

import { Button, Space, Typography } from '@jbpark/ui-kit';
import { ExternalLink, Github, SquarePlay } from 'lucide-react';

import { cn } from '~/utils';

const HIGHLIGHTS = [
  {
    title: 'Editor Mode',
    description:
      'A code editor with a real-time preview, synced via AST transforms.',
    path: '/docs/editor-mode',
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
      <div>
        <Typography.Title level={1}>Live Editor</Typography.Title>
        <Typography.Paragraph className="text-lg text-gray-500">
          An interactive editor for building UIs with real-time preview and
          drag-and-drop. Canvas edits sync back to source code via AST
          transforms.
        </Typography.Paragraph>
        <Space size="middle">
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
            icon={<Github />}
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
      </div>

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
