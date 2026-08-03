import { useLocalStorage } from '@jbpark/use-hooks';

import Live from '~/.';
import { STORAGE_KEY } from '~/constants';

const PreviewPage = () => {
  const [code] = useLocalStorage(STORAGE_KEY, '');

  if (!code) {
    return <div className="p-6 text-gray-500">No saved code found.</div>;
  }

  return (
    <Live>
      <Live.Renderer code={code} />
    </Live>
  );
};

export default PreviewPage;
