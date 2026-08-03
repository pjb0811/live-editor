import { type Section } from '../types';

export const STORAGE_KEY = 'live-editor-code';

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
  MODULE_IMPORT_EXPORT_LINE:
    /^\s*(?:import|export)\b[^\n]*\bfrom\s+['"][^'"]*['"];?\s*$/gm,
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
  INNER_HTML: 'innerHTML',
  ITEMS: 'items',
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
    id: 'hero',
    name: 'Hero',
    code: `
      <section
        data-name="Hero"
        className={cn(
          'text-center text-white',
          //
        )}
      >
        <ui.Space
          data-id=""
          data-binding={[
            {
              label: 'Background Style',
              property: 'style',
            },
          ]}
          style={{
            backgroundColor: '#6366f1',
          }}
          orientation="vertical"
          size="large"
          align="center"
          className={cn(
            'px-5 py-15',
            //
          )}
        >
          <h1
            data-id=""
            data-binding={[
              {
                label: 'Title',
                property: 'innerText',
              },
            ]}
            className={cn(
              'text-5xl font-bold',
              //
            )}
          >
            Welcome to Live Editor
          </h1>
          <p
            data-id=""
            data-binding={[
              {
                label: 'Description',
                property: 'innerText',
              },
            ]}
            className={cn(
              'text-xl',
              //
            )}
          >
            Build dynamic components with drag & drop
          </p>
          <ui.Button
            data-id=""
            data-binding={[
              {
                label: 'Button Text',
                property: 'innerText',
              },
              {
                label: 'Button Size',
                property: 'size',
                options: [
                  {
                    label: 'small',
                    value: 'small',
                  },
                  {
                    label: 'middle',
                    value: 'middle',
                  },
                  {
                    label: 'large',
                    value: 'large',
                  },
                ],
              },
              {
                label: 'Button Variant',
                property: 'variant',
                options: [
                  {
                    label: 'default',
                    value: 'default',
                  },
                  {
                    label: 'outlined',
                    value: 'outlined',
                  },
                ],
              },
            ]}
            size="large"
            variant="solid"
            className={cn(
              'bg-white text-indigo-500',
              'hover:bg-gray-50',
              //
            )}
          >
            Get Started
          </ui.Button>
        </ui.Space>
      </section>
    `,
  },
  {
    id: 'features',
    name: 'Features',
    code: `
      <section
        data-name="Features"
        className={cn(
          'px-5 py-10',
          //
        )}
      >
        <ui.Space
          data-id=""
          data-binding={[
            {
              label: 'Feature Cards',
              property: 'children',
            },
          ]}
          className={cn(
            'mx-auto max-w-7xl',
            //
          )}
          size="large"
          wrap
        >
          <ui.Card
            className={cn(
              'min-w-70 flex-1 text-center',
              //
            )}
          >
            <ui.Space orientation="vertical" size="middle" align="center">
              <div
                data-id=""
                data-binding={[
                  {
                    label: 'Icon',
                    property: 'innerText',
                  },
                ]}
                className={cn(
                  'text-5xl',
                  //
                )}
              >
                🚀
              </div>
              <h3
                data-id=""
                data-binding={[
                  {
                    label: 'Title',
                    property: 'innerText',
                  },
                ]}
                className={cn(
                  'text-2xl text-gray-800',
                  //
                )}
              >
                Feature 1
              </h3>
              <p
                data-id=""
                data-binding={[
                  {
                    label: 'Description',
                    property: 'innerText',
                  },
                ]}
                className={cn(
                  'text-gray-600',
                  //
                )}
              >
                Amazing feature description
              </p>
            </ui.Space>
          </ui.Card>
          <ui.Card
            className={cn(
              'min-w-70 flex-1 text-center',
              //
            )}
          >
            <ui.Space orientation="vertical" size="middle" align="center">
              <div
                data-id=""
                data-binding={[
                  {
                    label: 'Icon',
                    property: 'innerText',
                  },
                ]}
                className={cn(
                  'text-5xl',
                  //
                )}
              >
                ⚡
              </div>
              <h3
                data-id=""
                data-binding={[
                  {
                    label: 'Title',
                    property: 'innerText',
                  },
                ]}
                className={cn(
                  'text-2xl text-gray-800',
                  //
                )}
              >
                Feature 2
              </h3>
              <p
                data-id=""
                data-binding={[
                  {
                    label: 'Description',
                    property: 'innerText',
                  },
                ]}
                className={cn(
                  'text-gray-600',
                  //
                )}
              >
                Another great feature
              </p>
            </ui.Space>
          </ui.Card>
          <ui.Card
            className={cn(
              'min-w-70 flex-1 text-center',
              //
            )}
          >
            <ui.Space orientation="vertical" size="middle" align="center">
              <div
                data-id=""
                data-binding={[
                  {
                    label: 'Icon',
                    property: 'innerText',
                  },
                ]}
                className={cn(
                  'text-5xl',
                  //
                )}
              >
                ✨
              </div>
              <h3
                data-id=""
                data-binding={[
                  {
                    label: 'Title',
                    property: 'innerText',
                  },
                ]}
                className={cn(
                  'text-2xl text-gray-800',
                  //
                )}
              >
                Feature 3
              </h3>
              <p
                data-id=""
                data-binding={[
                  {
                    label: 'Description',
                    property: 'innerText',
                  },
                ]}
                className={cn(
                  'text-gray-600',
                  //
                )}
              >
                One more awesome thing
              </p>
            </ui.Space>
          </ui.Card>
        </ui.Space>
      </section>
    `,
  },
  {
    id: 'about',
    name: 'About',
    code: `
      <section
        data-name="About"
        className={cn(
          'mx-auto max-w-3xl px-5 py-10',
          //
        )}
      >
        <ui.Typography.Title
          data-id=""
          data-binding={[{ label: 'Title', property: 'innerText' }]}
          level={2}
          className={cn(
            'mb-5 text-4xl text-gray-800',
            //
          )}
        >
          About Live Editor
        </ui.Typography.Title>
        <ui.Typography.Paragraph
          data-id=""
          data-binding={[
            {
              label: 'Description 1',
              property: 'innerText',
            },
          ]}
          className={cn(
            'mb-4 text-lg leading-relaxed text-gray-600',
            //
          )}
        >
          Live Editor is a powerful visual development tool that enables you to
          create stunning web interfaces through an intuitive drag-and-drop
          experience. Built with modern web technologies, it streamlines your
          workflow and accelerates development cycles.
        </ui.Typography.Paragraph>
        <ui.Typography.Paragraph
          data-id=""
          data-binding={[
            {
              label: 'Description 2',
              property: 'innerText',
            },
          ]}
          className={cn(
            'text-lg leading-relaxed text-gray-600',
            //
          )}
        >
          Whether you&apos;re a seasoned developer or just starting out, Live
          Editor provides the flexibility and control you need to bring your
          creative vision to life. Focus on what matters most - building great
          products.
        </ui.Typography.Paragraph>
      </section>
    `,
  },
  {
    id: 'cta',
    name: 'CTA',
    code: `
      <section
        data-name="CTA"
        className={cn(
          'bg-gray-50 px-5 py-12 text-center',
          //
        )}
      >
        <div
          className={cn(
            'mx-auto max-w-xl',
            //
          )}
        >
          <ui.Typography.Title
            data-id=""
            data-binding={[{ label: 'Title', property: 'innerText' }]}
            level={2}
            className={cn(
              'mb-4 text-3xl text-gray-800',
              //
            )}
          >
            Ready to get started?
          </ui.Typography.Title>
          <ui.Typography.Paragraph
            data-id=""
            data-binding={[
              {
                label: 'Description',
                property: 'innerText',
              },
            ]}
            className={cn(
              'mb-6 text-lg text-gray-600',
              //
            )}
          >
            Start exploring what Live Editor can do for your projects
          </ui.Typography.Paragraph>
          <ui.Space
            data-id=""
            data-binding={[{ label: 'Buttons', property: 'children' }]}
            className={cn(
              'flex flex-wrap justify-center gap-4',
              //
            )}
          >
            <ui.Button
              data-id=""
              data-binding={[
                {
                  label: 'Button 1 Text',
                  property: 'innerText',
                },
              ]}
              size="large"
              className={cn(
                'bg-indigo-500 px-8 text-base text-white',
                'hover:bg-indigo-600',
                //
              )}
            >
              View Documentation
            </ui.Button>
            <ui.Button
              data-id=""
              data-binding={[
                {
                  label: 'Button 2 Text',
                  property: 'innerText',
                },
              ]}
              variant="outlined"
              size="large"
              className={cn(
                'border-2 border-indigo-500 px-8 text-base text-indigo-500',
                'hover:bg-indigo-50',
                //
              )}
            >
              View Examples
            </ui.Button>
          </ui.Space>
        </div>
      </section>
    `,
  },
  {
    id: 'getting-started',
    name: 'Getting Started',
    code: `
      <section
        data-name="Getting Started"
        className={cn(
          'px-5 py-16',
          //
        )}
      >
        <div
          className={cn(
            'mx-auto max-w-5xl',
            //
          )}
        >
          <ui.Typography.Title
            data-id=""
            data-binding={[{ label: 'Title', property: 'innerText' }]}
            level={2}
            className={cn(
              'mb-12 text-center text-4xl font-bold text-gray-800',
              //
            )}
          >
            How to Get Started
          </ui.Typography.Title>
          <div
            className={cn(
              'grid gap-8 md:grid-cols-3',
              //
            )}
          >
            <ui.Card
              data-id=""
              data-binding={[
                {
                  label: 'Card 1 Content',
                  property: 'children',
                },
              ]}
              className={cn(
                'rounded-lg border-2 border-gray-200 bg-white p-8',
                //
              )}
            >
              <ui.Typography.Title
                data-id=""
                data-binding={[
                  {
                    label: 'Card 1 Title',
                    property: 'innerText',
                  },
                ]}
                level={3}
                className={cn(
                  'mb-2 text-2xl font-bold text-gray-800',
                  //
                )}
              >
                Explore
              </ui.Typography.Title>
              <ui.Typography.Paragraph
                data-id=""
                data-binding={[
                  {
                    label: 'Card 1 Icon',
                    property: 'innerText',
                  },
                ]}
                className={cn(
                  'mb-6 text-4xl font-bold text-indigo-600',
                  //
                )}
              >
                📚
              </ui.Typography.Paragraph>
              <ul
                className={cn(
                  'mb-8 space-y-3 text-gray-600',
                  //
                )}
              >
                <li>✓ Read documentation</li>
                <li>✓ Browse examples</li>
                <li>✓ Try the demo</li>
              </ul>
              <ui.Button
                data-id=""
                data-binding={[
                  {
                    label: 'Card 1 Button',
                    property: 'innerText',
                  },
                ]}
                variant="outlined"
                size="large"
                block
                className={cn(
                  'border-2 border-indigo-500 text-indigo-500',
                  'hover:bg-indigo-50',
                  //
                )}
              >
                View Docs
              </ui.Button>
            </ui.Card>
            <ui.Card
              data-id=""
              data-binding={[
                {
                  label: 'Card 2 Content',
                  property: 'children',
                },
              ]}
              className={cn(
                'relative rounded-lg border-2 border-indigo-500 bg-white p-8',
                //
              )}
            >
              <div
                className={cn(
                  'absolute -top-4 left-1/2 -translate-x-1/2',
                  'rounded-full bg-indigo-500 px-4 py-1 text-sm text-white',
                  //
                )}
              >
                Recommended
              </div>
              <ui.Typography.Title
                data-id=""
                data-binding={[
                  {
                    label: 'Card 2 Title',
                    property: 'innerText',
                  },
                ]}
                level={3}
                className={cn(
                  'mb-2 text-2xl font-bold text-gray-800',
                  //
                )}
              >
                Practice
              </ui.Typography.Title>
              <ui.Typography.Paragraph
                data-id=""
                data-binding={[
                  {
                    label: 'Card 2 Icon',
                    property: 'innerText',
                  },
                ]}
                className={cn(
                  'mb-6 text-4xl font-bold text-indigo-600',
                  //
                )}
              >
                💻
              </ui.Typography.Paragraph>
              <ul
                className={cn(
                  'mb-8 space-y-3 text-gray-600',
                  //
                )}
              >
                <li>✓ Interactive playground</li>
                <li>✓ Experiment freely</li>
                <li>✓ Build your own</li>
              </ul>
              <ui.Button
                data-id=""
                data-binding={[
                  {
                    label: 'Card 2 Button',
                    property: 'innerText',
                  },
                ]}
                size="large"
                block
                className={cn(
                  'bg-indigo-500 text-white',
                  'hover:bg-indigo-600',
                  //
                )}
              >
                Start Building
              </ui.Button>
            </ui.Card>
            <ui.Card
              data-id=""
              data-binding={[
                {
                  label: 'Card 3 Content',
                  property: 'children',
                },
              ]}
              className={cn(
                'rounded-lg border-2 border-gray-200 bg-white p-8',
                //
              )}
            >
              <ui.Typography.Title
                data-id=""
                data-binding={[
                  {
                    label: 'Card 3 Title',
                    property: 'innerText',
                  },
                ]}
                level={3}
                className={cn(
                  'mb-2 text-2xl font-bold text-gray-800',
                  //
                )}
              >
                Contribute
              </ui.Typography.Title>
              <ui.Typography.Paragraph
                data-id=""
                data-binding={[
                  {
                    label: 'Card 3 Icon',
                    property: 'innerText',
                  },
                ]}
                className={cn(
                  'mb-6 text-4xl font-bold text-indigo-600',
                  //
                )}
              >
                🤝
              </ui.Typography.Paragraph>
              <ul
                className={cn(
                  'mb-8 space-y-3 text-gray-600',
                  //
                )}
              >
                <li>✓ Report issues</li>
                <li>✓ Suggest features</li>
                <li>✓ Submit pull requests</li>
              </ul>
              <ui.Button
                data-id=""
                data-binding={[
                  {
                    label: 'Card 3 Button',
                    property: 'innerText',
                  },
                ]}
                variant="outlined"
                size="large"
                block
                className={cn(
                  'border-2 border-indigo-500 text-indigo-500',
                  'hover:bg-indigo-50',
                  //
                )}
              >
                View on GitHub
              </ui.Button>
            </ui.Card>
          </div>
        </div>
      </section>
    `,
  },
  {
    id: 'key-features',
    name: 'Key Features',
    code: `
      <section
        data-name="Key Features"
        className={cn(
          'bg-indigo-50 px-5 py-16',
          //
        )}
      >
        <div
          className={cn(
            'mx-auto max-w-6xl',
            //
          )}
        >
          <h2
            className={cn(
              'mb-12 text-center text-4xl font-bold text-gray-800',
              //
            )}
          >
            Key Features
          </h2>
          <div
            className={cn(
              'grid gap-8 md:grid-cols-2',
              //
            )}
          >
            <div
              className={cn(
                'rounded-lg bg-white p-8 shadow-md',
                //
              )}
            >
              <div
                className={cn(
                  'mb-4 text-4xl',
                  //
                )}
              >
                🎨
              </div>
              <h3
                className={cn(
                  'mb-4 text-2xl font-bold text-gray-800',
                  //
                )}
              >
                Visual Editing
              </h3>
              <p
                className={cn(
                  'text-gray-600',
                  //
                )}
              >
                See your changes in real-time as you build. Live Editor provides
                instant visual feedback, making it easier to understand how code
                affects your interface.
              </p>
            </div>
            <div
              className={cn(
                'rounded-lg bg-white p-8 shadow-md',
                //
              )}
            >
              <div
                className={cn(
                  'mb-4 text-4xl',
                  //
                )}
              >
                🧩
              </div>
              <h3
                className={cn(
                  'mb-4 text-2xl font-bold text-gray-800',
                  //
                )}
              >
                Component-Based
              </h3>
              <p
                className={cn(
                  'text-gray-600',
                  //
                )}
              >
                Build with reusable components that you can drag, drop, and
                customize. Learn modern development patterns while creating your
                interface.
              </p>
            </div>
          </div>
        </div>
      </section>
    `,
  },
  {
    id: 'stats',
    name: 'Stats',
    code: `
      <section
        data-name="Stats"
        className={cn(
          'bg-indigo-600 text-white',
          //
        )}
      >
        <ui.Marquees
          data-id=""
          data-binding={[{ label: 'Stats Items', property: 'items' }]}
          speed={100}
          pauseOnHover={true}
          autoFill={true}
          className="px-5 py-16"
          items={[
            {
              key: 'stats-row',
              children: (
                <div
                  data-id=""
                  data-binding={[
                    {
                      label: 'Stats Cards',
                      property: 'children',
                    },
                  ]}
                  className={cn('flex gap-20')}
                >
                  <div
                    className={cn(
                      'min-w-60 text-center',
                      //
                    )}
                  >
                    <p
                      data-id=""
                      data-binding={[
                        {
                          label: 'Title',
                          property: 'innerText',
                        },
                      ]}
                      className={cn(
                        'mb-2 text-5xl font-bold',
                        //
                      )}
                    >
                      Open
                    </p>
                    <p
                      data-id=""
                      data-binding={[
                        {
                          label: 'Description',
                          property: 'innerText',
                        },
                      ]}
                      className={cn(
                        'text-indigo-200',
                        //
                      )}
                    >
                      Source Project
                    </p>
                  </div>
                  <div
                    className={cn(
                      'min-w-60 text-center',
                      //
                    )}
                  >
                    <p
                      data-id=""
                      data-binding={[
                        {
                          label: 'Title',
                          property: 'innerText',
                        },
                      ]}
                      className={cn(
                        'mb-2 text-5xl font-bold',
                        //
                      )}
                    >
                      Free
                    </p>
                    <p
                      data-id=""
                      data-binding={[
                        {
                          label: 'Description',
                          property: 'innerText',
                        },
                      ]}
                      className={cn(
                        'text-indigo-200',
                        //
                      )}
                    >
                      For Everyone
                    </p>
                  </div>
                  <div
                    className={cn(
                      'min-w-60 text-center',
                      //
                    )}
                  >
                    <p
                      data-id=""
                      data-binding={[
                        {
                          label: 'Title',
                          property: 'innerText',
                        },
                      ]}
                      className={cn(
                        'mb-2 text-5xl font-bold',
                        //
                      )}
                    >
                      Active
                    </p>
                    <p
                      data-id=""
                      data-binding={[
                        {
                          label: 'Description',
                          property: 'innerText',
                        },
                      ]}
                      className={cn(
                        'text-indigo-200',
                        //
                      )}
                    >
                      Community
                    </p>
                  </div>
                  <div
                    className={cn(
                      'min-w-60 text-center',
                      //
                    )}
                  >
                    <p
                      data-id=""
                      data-binding={[
                        {
                          label: 'Title',
                          property: 'innerText',
                        },
                      ]}
                      className={cn(
                        'mb-2 text-5xl font-bold',
                        //
                      )}
                    >
                      Learn
                    </p>
                    <p
                      data-id=""
                      data-binding={[
                        {
                          label: 'Description',
                          property: 'innerText',
                        },
                      ]}
                      className={cn(
                        'text-indigo-200',
                        //
                      )}
                    >
                      By Doing
                    </p>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </section>
    `,
  },
  {
    id: 'faq',
    name: 'FAQ',
    code: `
      <section
        data-name="FAQ"
        className={cn(
          'px-5 py-16',
          //
        )}
      >
        <div
          className={cn(
            'mx-auto max-w-3xl',
            //
          )}
        >
          <ui.Typography.Title
            data-id=""
            data-binding={[{ label: 'Title', property: 'innerText' }]}
            level={2}
            className={cn(
              'mb-12 text-center text-4xl font-bold text-gray-800',
              //
            )}
          >
            Frequently Asked Questions
          </ui.Typography.Title>
          <ui.Collapse
            data-id=""
            data-binding={[{ label: 'FAQ Items', property: 'items' }]}
            items={[
              {
                key: '1',
                label: (
                  <ui.Typography.Text
                    data-id=""
                    data-binding={[
                      {
                        label: 'Question 1',
                        property: 'innerText',
                      },
                    ]}
                    className={cn('text-lg font-semibold text-gray-800')}
                  >
                    What is Live Editor?
                  </ui.Typography.Text>
                ),
                children: (
                  <ui.Typography.Paragraph
                    data-id=""
                    data-binding={[
                      {
                        label: 'Answer 1',
                        property: 'innerText',
                      },
                    ]}
                    className={cn('text-gray-600')}
                  >
                    Live Editor is an open-source tool for building web
                    interfaces visually. It helps you learn web development by
                    providing instant feedback as you build components.
                  </ui.Typography.Paragraph>
                ),
              },
              {
                key: '2',
                label: (
                  <ui.Typography.Text
                    data-id=""
                    data-binding={[
                      {
                        label: 'Question 2',
                        property: 'innerText',
                      },
                    ]}
                    className={cn('text-lg font-semibold text-gray-800')}
                  >
                    Do I need coding experience?
                  </ui.Typography.Text>
                ),
                children: (
                  <ui.Typography.Paragraph
                    data-id=""
                    data-binding={[
                      {
                        label: 'Answer 2',
                        property: 'innerText',
                      },
                    ]}
                    className={cn('text-gray-600')}
                  >
                    No! Live Editor is designed for all skill levels. Beginners
                    can learn through visual editing, while experienced
                    developers can work directly with code.
                  </ui.Typography.Paragraph>
                ),
              },
              {
                key: '3',
                label: (
                  <ui.Typography.Text
                    data-id=""
                    data-binding={[
                      {
                        label: 'Question 3',
                        property: 'innerText',
                      },
                    ]}
                    className={cn('text-lg font-semibold text-gray-800')}
                  >
                    Is it really free?
                  </ui.Typography.Text>
                ),
                children: (
                  <ui.Typography.Paragraph
                    data-id=""
                    data-binding={[
                      {
                        label: 'Answer 3',
                        property: 'innerText',
                      },
                    ]}
                    className={cn('text-gray-600')}
                  >
                    Yes, completely free! Live Editor is an open-source project
                    with no hidden costs or premium tiers. All features are
                    available to everyone.
                  </ui.Typography.Paragraph>
                ),
              },
              {
                key: '4',
                label: (
                  <ui.Typography.Text
                    data-id=""
                    data-binding={[
                      {
                        label: 'Question 4',
                        property: 'innerText',
                      },
                    ]}
                    className={cn('text-lg font-semibold text-gray-800')}
                  >
                    How can I contribute?
                  </ui.Typography.Text>
                ),
                children: (
                  <ui.Typography.Paragraph
                    data-id=""
                    data-binding={[
                      {
                        label: 'Answer 4',
                        property: 'innerText',
                      },
                    ]}
                    className={cn('text-gray-600')}
                  >
                    You can contribute by reporting bugs, suggesting features,
                    sharing your projects, or contributing code. Check our
                    GitHub repository for more details.
                  </ui.Typography.Paragraph>
                ),
              },
            ]}
          />
        </div>
      </section>
    `,
  },
];
