import { Space, Typography } from '@jbpark/ui-kit';

interface Props {
  title: React.ReactNode;
  detail: React.ReactNode;
}

// What an empty canvas says: why it is empty, and what to do about it.
const CanvasNotice = ({ title, detail }: Props) => (
  <Space orientation="vertical" align="center">
    <Typography.Paragraph>{title}</Typography.Paragraph>
    <Typography.Text>{detail}</Typography.Text>
  </Space>
);

export default CanvasNotice;
