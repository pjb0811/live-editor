import { useMemo } from 'react';

import Live from '~/.';
import { STORAGE_KEY } from '~/enums';

const PreviewPage = () => {
  const code = useMemo(() => localStorage.getItem(STORAGE_KEY), []);

  if (!code) {
    return <div className="p-6 text-gray-500">No saved code found.</div>;
  }

  return (
    <Live>
      <Live.Preview code={code} scripts={['/js/tailwindcss.js']} />
    </Live>
  );
};

export default PreviewPage;
