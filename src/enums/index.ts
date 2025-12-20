export const DEFAULT_TEMPLATE = `
import { useState } from "react";
import { Button, Card } from "antd";
import { cn } from "~/utils";

const App = ({ breakpoint, headers, container }) => {
  const [count, setCount] = useState(0);

  return (
    <main id="app-container">
      <section
        className={cn(
          'flex items-center justify-center',
          'min-h-100 bg-gradient-to-br from-blue-100 to-purple-200',
        )}
      >
        <Card
          className="shadow-xl"
          style={{ width: 400 }}
          title={
            <span className="text-xl font-bold text-blue-700">
              Live Editor에 오신 것을 환영합니다!
            </span>
          }
        >
          <p className="mb-6 text-gray-700">
            아래 버튼을 눌러 상태가 어떻게 변하는지 확인해보세요.
          </p>
          <Button
            type="primary"
            size="large"
            onClick={() => setCount(count + 1)}
          >
            클릭 횟수: {count}
          </Button>
        </Card>
      </section>
    </main>
  );
}

export default App;
`;

export const DRAGGABLE_ITEMS = [
  {
    id: 'main',
    name: '메인',
    code: `
      <section
        className={cn(
          'flex items-center justify-center',
          'min-h-100 bg-gradient-to-br from-blue-100 to-purple-200',
        )}
      >
        <Card
          className="shadow-xl"
          style={{ width: 400 }}
          title={
            <span className="text-xl font-bold text-blue-700">
              Live Editor에 오신 것을 환영합니다!
            </span>
          }
        >
          <p className="mb-6 text-gray-700">
            아래 버튼을 눌러 상태가 어떻게 변하는지 확인해보세요.
          </p>
          <Button
            type="primary"
            size="large"
            onClick={() => setCount(count + 1)}
          >
            클릭 횟수: {count}
          </Button>
        </Card>
      </section>
    `,
  },
];
