import { useNavigate } from 'react-router-dom';

import { Button, Space, Typography } from '@jbpark/ui-kit';
import { ExternalLink, Github } from 'lucide-react';

import './App.css';

const HIGHLIGHTS = [
  'Real-time canvas edits sync back to source code via AST transforms',
  'Drag-and-drop builder with an interactive property panel',
  'Isolated iframe preview for DOM/CSS separation',
];

const Intro = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Space
        orientation="vertical"
        align="center"
        size="large"
        className="max-w-2xl text-center"
      >
        <Typography.Title level={1}>Live Editor</Typography.Title>
        <Typography.Paragraph className="text-lg text-gray-500">
          An interactive editor for building UIs with real-time preview and
          drag-and-drop.
        </Typography.Paragraph>
        <ul className="space-y-2 text-left text-gray-600">
          {HIGHLIGHTS.map(highlight => (
            <li key={highlight}>• {highlight}</li>
          ))}
        </ul>
        <Space size="middle">
          <Button
            type="primary"
            size="large"
            onClick={() => navigate('/editor')}
          >
            Open Editor
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
      </Space>
    </div>
  );
};

export default Intro;
