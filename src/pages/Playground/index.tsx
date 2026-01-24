import * as ui from '@jbpark/ui-kit';
import { cn } from '@jbpark/ui-kit/utils';

const App = () => {
  return (
    <main id="app-container">
      <section
        data-name="Hero"
        className={cn(
          'bg-linear-to-br from-indigo-500 to-purple-600',
          'px-5 py-15',
          'text-center text-white',
          //
        )}
      >
        <ui.Space orientation="vertical" size="large" align="center">
          <h1
            data-id=""
            data-binding={[{ label: 'Title', property: 'innerText' }]}
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
            ]}
            size="large"
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
      <section
        data-name="Features"
        className={cn(
          'px-5 py-10',
          //
        )}
      >
        <ui.Space
          data-id="B4EJxe"
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
                data-id="RSDQfg"
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
                data-id="Q23gxA"
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
                data-id="jMVy3Z"
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
                data-id="9uOauS"
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
                data-id="RU3j4v"
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
                data-id="rcqPQM"
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
                data-id="xS5vQ3"
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
                data-id="Z6Z2K8"
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
                data-id="lG7apX"
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
          data-binding={[{ label: 'Description 1', property: 'innerText' }]}
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
          data-binding={[{ label: 'Description 2', property: 'innerText' }]}
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
          <h2
            className={cn(
              'mb-4 text-3xl text-gray-800',
              //
            )}
          >
            Ready to get started?
          </h2>
          <p
            className={cn(
              'mb-6 text-lg text-gray-600',
              //
            )}
          >
            Start exploring what Live Editor can do for your projects
          </p>
          <div
            className={cn(
              'flex flex-wrap justify-center gap-4',
              //
            )}
          >
            <button
              className={cn(
                'cursor-pointer rounded border-none',
                'bg-indigo-500 px-8 py-3 text-base text-white',
                'transition-colors hover:bg-indigo-600',
                //
              )}
            >
              View Documentation
            </button>
            <button
              className={cn(
                'cursor-pointer rounded',
                `border-2 border-indigo-500 bg-white px-8 py-3 text-base
                text-indigo-500`,
                'transition-colors hover:bg-indigo-50',
                //
              )}
            >
              View Examples
            </button>
          </div>
        </div>
      </section>
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
          <h2
            className={cn(
              'mb-12 text-center text-4xl font-bold text-gray-800',
              //
            )}
          >
            How to Get Started
          </h2>
          <div
            className={cn(
              'grid gap-8 md:grid-cols-3',
              //
            )}
          >
            <div
              className={cn(
                'rounded-lg border-2 border-gray-200 bg-white p-8',
                //
              )}
            >
              <h3
                className={cn(
                  'mb-2 text-2xl font-bold text-gray-800',
                  //
                )}
              >
                Explore
              </h3>
              <p
                className={cn(
                  'mb-6 text-4xl font-bold text-indigo-600',
                  //
                )}
              >
                📚
              </p>
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
              <button
                className={cn(
                  'w-full cursor-pointer rounded border-2 border-indigo-500',
                  'bg-white px-6 py-3 text-indigo-500',
                  'transition-colors hover:bg-indigo-50',
                  //
                )}
              >
                View Docs
              </button>
            </div>
            <div
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
              <h3
                className={cn(
                  'mb-2 text-2xl font-bold text-gray-800',
                  //
                )}
              >
                Practice
              </h3>
              <p
                className={cn(
                  'mb-6 text-4xl font-bold text-indigo-600',
                  //
                )}
              >
                💻
              </p>
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
              <button
                className={cn(
                  'w-full cursor-pointer rounded border-none',
                  'bg-indigo-500 px-6 py-3 text-white',
                  'transition-colors hover:bg-indigo-600',
                  //
                )}
              >
                Start Building
              </button>
            </div>
            <div
              className={cn(
                'rounded-lg border-2 border-gray-200 bg-white p-8',
                //
              )}
            >
              <h3
                className={cn(
                  'mb-2 text-2xl font-bold text-gray-800',
                  //
                )}
              >
                Contribute
              </h3>
              <p
                className={cn(
                  'mb-6 text-4xl font-bold text-indigo-600',
                  //
                )}
              >
                🤝
              </p>
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
              <button
                className={cn(
                  'w-full cursor-pointer rounded border-2 border-indigo-500',
                  'bg-white px-6 py-3 text-indigo-500',
                  'transition-colors hover:bg-indigo-50',
                  //
                )}
              >
                View on GitHub
              </button>
            </div>
          </div>
        </div>
      </section>
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
      <section
        data-name="Stats"
        className={cn(
          'bg-indigo-600 px-5 py-16 text-white',
          //
        )}
      >
        <ui.Marquees
          data-id=""
          data-binding={[{ label: 'Stats Items', property: 'items' }]}
          speed={100}
          pauseOnHover={true}
          autoFill={true}
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
          <h2
            className={cn(
              'mb-12 text-center text-4xl font-bold text-gray-800',
              //
            )}
          >
            Frequently Asked Questions
          </h2>
          <div
            className={cn(
              'space-y-6',
              //
            )}
          >
            <div
              className={cn(
                'rounded-lg border border-gray-200 bg-white p-6',
                //
              )}
            >
              <h3
                className={cn(
                  'mb-3 text-xl font-semibold text-gray-800',
                  //
                )}
              >
                What is Live Editor?
              </h3>
              <p
                className={cn(
                  'text-gray-600',
                  //
                )}
              >
                Live Editor is an open-source tool for building web interfaces
                visually. It helps you learn web development by providing
                instant feedback as you build components.
              </p>
            </div>
            <div
              className={cn(
                'rounded-lg border border-gray-200 bg-white p-6',
                //
              )}
            >
              <h3
                className={cn(
                  'mb-3 text-xl font-semibold text-gray-800',
                  //
                )}
              >
                Do I need coding experience?
              </h3>
              <p
                className={cn(
                  'text-gray-600',
                  //
                )}
              >
                No! Live Editor is designed for all skill levels. Beginners can
                learn through visual editing, while experienced developers can
                work directly with code.
              </p>
            </div>
            <div
              className={cn(
                'rounded-lg border border-gray-200 bg-white p-6',
                //
              )}
            >
              <h3
                className={cn(
                  'mb-3 text-xl font-semibold text-gray-800',
                  //
                )}
              >
                Is it really free?
              </h3>
              <p
                className={cn(
                  'text-gray-600',
                  //
                )}
              >
                Yes, completely free! Live Editor is an open-source project with
                no hidden costs or premium tiers. All features are available to
                everyone.
              </p>
            </div>
            <div
              className={cn(
                'rounded-lg border border-gray-200 bg-white p-6',
                //
              )}
            >
              <h3
                className={cn(
                  'mb-3 text-xl font-semibold text-gray-800',
                  //
                )}
              >
                How can I contribute?
              </h3>
              <p
                className={cn(
                  'text-gray-600',
                  //
                )}
              >
                You can contribute by reporting bugs, suggesting features,
                sharing your projects, or contributing code. Check our GitHub
                repository for more details.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default App;
