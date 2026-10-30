import type { Section } from '../types';

// The sections `Live.Dnd`'s palette offers when the host passes no `items`.
// Plain elements with Tailwind classes, so they need no imports or modules.
// `@jbpark/live-editor/ui-kit` has the same sections built with ui-kit
// (`uiKitPaletteSections`).
export const PALETTE_SECTIONS: Section[] = [
  {
    id: 'hero',
    name: 'Hero',
    code: `
      <section data-name="Hero" className="text-center text-white">
        <div
          data-id=""
          data-binding={[
            {
              label: 'Background Style',
              property: 'style',
              type: 'object',
              // Types the keys inside the object value; a leaf takes the same
              // fields as a top-level binding.
              render: {
                backgroundColor: { type: 'color', label: 'Background Color' },
                gap: {
                  type: 'number',
                  label: 'Content Spacing',
                  // Constraints the library validates with or without a
                  // widget.
                  min: 0,
                  max: 40,
                  // Presentation only: the built-in panel ignores it and
                  // shows a number input; a custom panel can switch on
                  // widget.type.
                  widget: { type: 'slider', step: 4, unit: 'px' },
                },
              },
              // Not a library field, so it arrives as meta.group.
              group: 'layout',
            },
          ]}
          style={{ backgroundColor: '#6366f1', gap: 16 }}
          className="flex flex-col items-center px-5 py-15"
        >
          <h1
            data-id=""
            data-binding={[
              {
                label: 'Title',
                property: 'innerText',
                type: 'string',
                required: true,
              },
            ]}
            className="text-5xl font-bold"
          >
            Welcome to Live Editor
          </h1>
          <p
            data-id=""
            data-binding={[{ label: 'Description', type: 'richtext' }]}
            className="text-xl"
          >
            Build <strong>dynamic components</strong> with drag & drop
          </p>
          <a
            data-id=""
            data-binding={[
              { label: 'Button Text', property: 'innerText' },
              { label: 'Button Link', property: 'href', type: 'url' },
            ]}
            href="https://github.com/pjb0811/live-editor"
            className="rounded-md bg-white px-6 py-3 text-lg font-medium text-indigo-500 hover:bg-gray-50"
          >
            🚀 Get Started
          </a>
        </div>
      </section>
    `,
  },
  {
    id: 'features',
    name: 'Features',
    code: `
      <section data-name="Features" className="px-5 py-10">
        <div
          data-id=""
          data-binding={[{ label: 'Feature Cards', property: 'children' }]}
          className="mx-auto flex max-w-7xl flex-wrap gap-6"
        >
          <div className="min-w-70 flex-1 rounded-lg border border-gray-200 bg-white p-6 text-center">
            <div
              data-id=""
              data-binding={[{ label: 'Icon', property: 'innerText' }]}
              className="mb-3 text-5xl"
            >
              🚀
            </div>
            <h3
              data-id=""
              data-binding={[{ label: 'Title', property: 'innerText' }]}
              className="mb-2 text-2xl text-gray-800"
            >
              Feature 1
            </h3>
            <p
              data-id=""
              data-binding={[{ label: 'Description', property: 'innerText' }]}
              className="text-gray-600"
            >
              Amazing feature description
            </p>
          </div>
          <div className="min-w-70 flex-1 rounded-lg border border-gray-200 bg-white p-6 text-center">
            <div
              data-id=""
              data-binding={[{ label: 'Icon', property: 'innerText' }]}
              className="mb-3 text-5xl"
            >
              ⚡
            </div>
            <h3
              data-id=""
              data-binding={[{ label: 'Title', property: 'innerText' }]}
              className="mb-2 text-2xl text-gray-800"
            >
              Feature 2
            </h3>
            <p
              data-id=""
              data-binding={[{ label: 'Description', property: 'innerText' }]}
              className="text-gray-600"
            >
              Another great feature
            </p>
          </div>
          <div className="min-w-70 flex-1 rounded-lg border border-gray-200 bg-white p-6 text-center">
            <div
              data-id=""
              data-binding={[{ label: 'Icon', property: 'innerText' }]}
              className="mb-3 text-5xl"
            >
              ✨
            </div>
            <h3
              data-id=""
              data-binding={[{ label: 'Title', property: 'innerText' }]}
              className="mb-2 text-2xl text-gray-800"
            >
              Feature 3
            </h3>
            <p
              data-id=""
              data-binding={[{ label: 'Description', property: 'innerText' }]}
              className="text-gray-600"
            >
              One more awesome thing
            </p>
          </div>
        </div>
      </section>
    `,
  },
  {
    id: 'about',
    name: 'About',
    code: `
      <section data-name="About" className="mx-auto max-w-3xl px-5 py-10">
        <h2
          data-id=""
          data-binding={[{ label: 'Title', property: 'innerText' }]}
          className="mb-5 text-4xl font-semibold text-gray-800"
        >
          About Live Editor
        </h2>
        <p
          data-id=""
          data-binding={[{ label: 'Description 1', type: 'richtext' }]}
          className="mb-4 text-lg leading-relaxed text-gray-600"
        >
          Live Editor is a powerful visual development tool that enables you to
          create stunning web interfaces through an intuitive drag-and-drop
          experience. Built with modern web technologies, it streamlines your
          workflow and accelerates development cycles.
        </p>
        <p
          data-id=""
          data-binding={[{ label: 'Description 2', type: 'richtext' }]}
          className="text-lg leading-relaxed text-gray-600"
        >
          Whether you&apos;re a seasoned developer or just starting out, Live
          Editor provides the flexibility and control you need to bring your
          creative vision to life. Focus on what matters most - building great
          products.
        </p>
      </section>
    `,
  },
  {
    id: 'cta',
    name: 'CTA',
    code: `
      <section data-name="CTA" className="bg-gray-50 px-5 py-12 text-center">
        <div className="mx-auto max-w-xl">
          <h2
            data-id=""
            data-binding={[{ label: 'Title', property: 'innerText' }]}
            className="mb-4 text-3xl font-semibold text-gray-800"
          >
            Ready to get started?
          </h2>
          <p
            data-id=""
            data-binding={[{ label: 'Description', property: 'innerText' }]}
            className="mb-6 text-lg text-gray-600"
          >
            Start exploring what Live Editor can do for your projects
          </p>
          <div
            data-id=""
            data-binding={[{ label: 'Buttons', property: 'children' }]}
            className="flex flex-wrap justify-center gap-4"
          >
            <a
              data-id=""
              data-binding={[{ label: 'Button 1 Text', property: 'innerText' }]}
              href="#"
              className="rounded-md bg-indigo-500 px-8 py-3 text-base text-white hover:bg-indigo-600"
            >
              View Documentation
            </a>
            <a
              data-id=""
              data-binding={[{ label: 'Button 2 Text', property: 'innerText' }]}
              href="#"
              className="rounded-md border-2 border-indigo-500 px-8 py-3 text-base text-indigo-500 hover:bg-indigo-50"
            >
              View Examples
            </a>
          </div>
        </div>
      </section>
    `,
  },
  {
    id: 'getting-started',
    name: 'Getting Started',
    code: `
      <section data-name="Getting Started" className="px-5 py-16">
        <div className="mx-auto max-w-5xl">
          <h2
            data-id=""
            data-binding={[{ label: 'Title', property: 'innerText' }]}
            className="mb-12 text-center text-4xl font-bold text-gray-800"
          >
            How to Get Started
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div
              data-id=""
              data-binding={[{ label: 'Card 1 Content', property: 'children' }]}
              className="rounded-lg border-2 border-gray-200 bg-white p-8"
            >
              <h3
                data-id=""
                data-binding={[{ label: 'Card 1 Title', property: 'innerText' }]}
                className="mb-2 text-2xl font-bold text-gray-800"
              >
                Explore
              </h3>
              <p
                data-id=""
                data-binding={[{ label: 'Card 1 Icon', property: 'innerText' }]}
                className="mb-6 text-4xl font-bold text-indigo-600"
              >
                📚
              </p>
              <ul className="mb-8 space-y-3 text-gray-600">
                <li>✓ Read documentation</li>
                <li>✓ Browse examples</li>
                <li>✓ Try the demo</li>
              </ul>
              <a
                data-id=""
                data-binding={[{ label: 'Card 1 Button', property: 'innerText' }]}
                href="#"
                className="block rounded-md border-2 border-indigo-500 px-4 py-2 text-center text-indigo-500 hover:bg-indigo-50"
              >
                View Docs
              </a>
            </div>
            <div
              data-id=""
              data-binding={[{ label: 'Card 2 Content', property: 'children' }]}
              className="relative rounded-lg border-2 border-indigo-500 bg-white p-8"
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-4 py-1 text-sm text-white">
                Recommended
              </div>
              <h3
                data-id=""
                data-binding={[{ label: 'Card 2 Title', property: 'innerText' }]}
                className="mb-2 text-2xl font-bold text-gray-800"
              >
                Practice
              </h3>
              <p
                data-id=""
                data-binding={[{ label: 'Card 2 Icon', property: 'innerText' }]}
                className="mb-6 text-4xl font-bold text-indigo-600"
              >
                💻
              </p>
              <ul className="mb-8 space-y-3 text-gray-600">
                <li>✓ Interactive playground</li>
                <li>✓ Experiment freely</li>
                <li>✓ Build your own</li>
              </ul>
              <a
                data-id=""
                data-binding={[{ label: 'Card 2 Button', property: 'innerText' }]}
                href="#"
                className="block rounded-md bg-indigo-500 px-4 py-2 text-center text-white hover:bg-indigo-600"
              >
                Start Building
              </a>
            </div>
            <div
              data-id=""
              data-binding={[{ label: 'Card 3 Content', property: 'children' }]}
              className="rounded-lg border-2 border-gray-200 bg-white p-8"
            >
              <h3
                data-id=""
                data-binding={[{ label: 'Card 3 Title', property: 'innerText' }]}
                className="mb-2 text-2xl font-bold text-gray-800"
              >
                Contribute
              </h3>
              <p
                data-id=""
                data-binding={[{ label: 'Card 3 Icon', property: 'innerText' }]}
                className="mb-6 text-4xl font-bold text-indigo-600"
              >
                🤝
              </p>
              <ul className="mb-8 space-y-3 text-gray-600">
                <li>✓ Report issues</li>
                <li>✓ Suggest features</li>
                <li>✓ Submit pull requests</li>
              </ul>
              <a
                data-id=""
                data-binding={[{ label: 'Card 3 Button', property: 'innerText' }]}
                href="#"
                className="block rounded-md border-2 border-indigo-500 px-4 py-2 text-center text-indigo-500 hover:bg-indigo-50"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>
    `,
  },
  {
    id: 'key-features',
    name: 'Key Features',
    code: `
      <section data-name="Key Features" className="bg-indigo-50 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <h2
            data-id=""
            data-binding={[{ label: 'Title', property: 'innerText' }]}
            className="mb-12 text-center text-4xl font-bold text-gray-800"
          >
            Key Features
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-lg bg-white p-8 shadow-md">
              <div className="mb-4 text-4xl">🎨</div>
              <h3 className="mb-4 text-2xl font-bold text-gray-800">
                Visual Editing
              </h3>
              <p className="text-gray-600">
                See your changes in real-time as you build. Live Editor provides
                instant visual feedback, making it easier to understand how code
                affects your interface.
              </p>
            </div>
            <div className="rounded-lg bg-white p-8 shadow-md">
              <div className="mb-4 text-4xl">🧩</div>
              <h3 className="mb-4 text-2xl font-bold text-gray-800">
                Component-Based
              </h3>
              <p className="text-gray-600">
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
      <section data-name="Stats" className="bg-indigo-600 px-5 py-16 text-white">
        <div
          data-id=""
          data-binding={[{ label: 'Stats Cards', property: 'children' }]}
          className="mx-auto flex max-w-6xl flex-wrap justify-center gap-10"
        >
          <div className="min-w-50 flex-1 text-center">
            <p
              data-id=""
              data-binding={[{ label: 'Title', property: 'innerText' }]}
              className="mb-2 text-5xl font-bold"
            >
              Open
            </p>
            <p
              data-id=""
              data-binding={[{ label: 'Description', property: 'innerText' }]}
              className="text-indigo-200"
            >
              Source Project
            </p>
          </div>
          <div className="min-w-50 flex-1 text-center">
            <p
              data-id=""
              data-binding={[{ label: 'Title', property: 'innerText' }]}
              className="mb-2 text-5xl font-bold"
            >
              Free
            </p>
            <p
              data-id=""
              data-binding={[{ label: 'Description', property: 'innerText' }]}
              className="text-indigo-200"
            >
              For Everyone
            </p>
          </div>
          <div className="min-w-50 flex-1 text-center">
            <p
              data-id=""
              data-binding={[{ label: 'Title', property: 'innerText' }]}
              className="mb-2 text-5xl font-bold"
            >
              Active
            </p>
            <p
              data-id=""
              data-binding={[{ label: 'Description', property: 'innerText' }]}
              className="text-indigo-200"
            >
              Community
            </p>
          </div>
          <div className="min-w-50 flex-1 text-center">
            <p
              data-id=""
              data-binding={[{ label: 'Title', property: 'innerText' }]}
              className="mb-2 text-5xl font-bold"
            >
              Learn
            </p>
            <p
              data-id=""
              data-binding={[{ label: 'Description', property: 'innerText' }]}
              className="text-indigo-200"
            >
              By Doing
            </p>
          </div>
        </div>
      </section>
    `,
  },
  {
    id: 'roadmap',
    name: 'Roadmap',
    code: `
      <section data-name="Roadmap" className="px-5 py-16">
        <div className="mx-auto max-w-3xl">
          <h2
            data-id=""
            data-binding={[
              { label: 'Title', property: 'innerText', required: true },
            ]}
            className="mb-8 text-center text-4xl font-bold text-gray-800"
          >
            Roadmap
          </h2>
          <ol
            data-id=""
            data-binding={[{ label: 'Milestones', property: 'children' }]}
          >
            <li className="flex items-center gap-4 border-b border-gray-100 py-4">
              <span
                data-id=""
                data-binding={[
                  {
                    label: 'Accent',
                    property: 'style',
                    type: 'object',
                    render: {
                      backgroundColor: { type: 'color', label: 'Accent Color' },
                    },
                  },
                ]}
                style={{ backgroundColor: '#22c55e' }}
                className="size-3 shrink-0 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <p
                  data-id=""
                  data-binding={[
                    { label: 'Title', property: 'innerText', required: true },
                  ]}
                  className="font-semibold text-gray-800"
                >
                  Visual editing
                </p>
                <p className="text-sm text-gray-500">
                  <time
                    data-id=""
                    data-binding={[
                      {
                        label: 'Release Date',
                        property: 'dateTime',
                        type: 'date',
                        required: true,
                      },
                      { label: 'Date Text', property: 'innerText' },
                    ]}
                    dateTime="2026-03-02"
                  >
                    March 2, 2026
                  </time>
                  {' · '}
                  <span
                    data-id=""
                    data-binding={[
                      {
                        label: 'Status',
                        property: 'innerText',
                        options: [
                          { label: 'Planned', value: 'Planned' },
                          { label: 'In Progress', value: 'In Progress' },
                          { label: 'Shipped', value: 'Shipped' },
                        ],
                      },
                    ]}
                  >
                    Shipped
                  </span>
                </p>
                <progress
                  data-id=""
                  data-binding={[
                    {
                      label: 'Progress',
                      property: 'value',
                      type: 'number',
                      min: 0,
                      max: 100,
                      widget: { type: 'slider', step: 10, unit: '%' },
                    },
                  ]}
                  value={100}
                  max={100}
                  className="mt-2 h-2 w-full"
                />
              </div>
              <a
                data-id=""
                data-binding={[
                  { label: 'Link Text', property: 'innerText' },
                  {
                    label: 'Link URL',
                    property: 'href',
                    type: 'url',
                    pattern: '^https://',
                    // Not a library field, so it arrives as meta.hint.
                    hint: 'Must use https',
                  },
                ]}
                href="https://github.com"
                className="text-sm text-indigo-500 hover:underline"
              >
                Release notes
              </a>
            </li>
            <li className="flex items-center gap-4 border-b border-gray-100 py-4">
              <span
                data-id=""
                data-binding={[
                  {
                    label: 'Accent',
                    property: 'style',
                    type: 'object',
                    render: {
                      backgroundColor: { type: 'color', label: 'Accent Color' },
                    },
                  },
                ]}
                style={{ backgroundColor: '#6366f1' }}
                className="size-3 shrink-0 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <p
                  data-id=""
                  data-binding={[
                    { label: 'Title', property: 'innerText', required: true },
                  ]}
                  className="font-semibold text-gray-800"
                >
                  Custom panels
                </p>
                <p className="text-sm text-gray-500">
                  <time
                    data-id=""
                    data-binding={[
                      {
                        label: 'Release Date',
                        property: 'dateTime',
                        type: 'date',
                        required: true,
                      },
                      { label: 'Date Text', property: 'innerText' },
                    ]}
                    dateTime="2026-09-26"
                  >
                    September 26, 2026
                  </time>
                  {' · '}
                  <span
                    data-id=""
                    data-binding={[
                      {
                        label: 'Status',
                        property: 'innerText',
                        options: [
                          { label: 'Planned', value: 'Planned' },
                          { label: 'In Progress', value: 'In Progress' },
                          { label: 'Shipped', value: 'Shipped' },
                        ],
                      },
                    ]}
                  >
                    In Progress
                  </span>
                </p>
                <progress
                  data-id=""
                  data-binding={[
                    {
                      label: 'Progress',
                      property: 'value',
                      type: 'number',
                      min: 0,
                      max: 100,
                      widget: { type: 'slider', step: 10, unit: '%' },
                    },
                  ]}
                  value={60}
                  max={100}
                  className="mt-2 h-2 w-full"
                />
              </div>
              <a
                data-id=""
                data-binding={[
                  { label: 'Link Text', property: 'innerText' },
                  {
                    label: 'Link URL',
                    property: 'href',
                    type: 'url',
                    pattern: '^https://',
                    // Not a library field, so it arrives as meta.hint.
                    hint: 'Must use https',
                  },
                ]}
                href="https://github.com"
                className="text-sm text-indigo-500 hover:underline"
              >
                Guide
              </a>
            </li>
            <li className="flex items-center gap-4 border-b border-gray-100 py-4">
              <span
                data-id=""
                data-binding={[
                  {
                    label: 'Accent',
                    property: 'style',
                    type: 'object',
                    render: {
                      backgroundColor: { type: 'color', label: 'Accent Color' },
                    },
                  },
                ]}
                style={{ backgroundColor: '#f59e0b' }}
                className="size-3 shrink-0 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <p
                  data-id=""
                  data-binding={[
                    { label: 'Title', property: 'innerText', required: true },
                  ]}
                  className="font-semibold text-gray-800"
                >
                  Collaboration
                </p>
                <p className="text-sm text-gray-500">
                  <time
                    data-id=""
                    data-binding={[
                      {
                        label: 'Release Date',
                        property: 'dateTime',
                        type: 'date',
                        required: true,
                      },
                      { label: 'Date Text', property: 'innerText' },
                    ]}
                    dateTime="2027-01-15"
                  >
                    January 15, 2027
                  </time>
                  {' · '}
                  <span
                    data-id=""
                    data-binding={[
                      {
                        label: 'Status',
                        property: 'innerText',
                        options: [
                          { label: 'Planned', value: 'Planned' },
                          { label: 'In Progress', value: 'In Progress' },
                          { label: 'Shipped', value: 'Shipped' },
                        ],
                      },
                    ]}
                  >
                    Planned
                  </span>
                </p>
                <progress
                  data-id=""
                  data-binding={[
                    {
                      label: 'Progress',
                      property: 'value',
                      type: 'number',
                      min: 0,
                      max: 100,
                      widget: { type: 'slider', step: 10, unit: '%' },
                    },
                  ]}
                  value={0}
                  max={100}
                  className="mt-2 h-2 w-full"
                />
              </div>
              <a
                data-id=""
                data-binding={[
                  { label: 'Link Text', property: 'innerText' },
                  {
                    label: 'Link URL',
                    property: 'href',
                    type: 'url',
                    pattern: '^https://',
                    // Not a library field, so it arrives as meta.hint.
                    hint: 'Must use https',
                  },
                ]}
                href="https://github.com"
                className="text-sm text-indigo-500 hover:underline"
              >
                Discussion
              </a>
            </li>
          </ol>
          <p className="mt-6 text-center text-sm text-gray-500">
            Last updated{' '}
            <time
              data-id=""
              data-binding={[
                {
                  label: 'Updated On',
                  property: 'dateTime',
                  type: 'date',
                  required: true,
                },
                { label: 'Updated Text', property: 'innerText' },
              ]}
              dateTime="2026-09-26"
            >
              September 26, 2026
            </time>
            {' · '}
            <a
              data-id=""
              data-binding={[
                { label: 'Link Text', property: 'innerText' },
                {
                  label: 'Link URL',
                  property: 'href',
                  type: 'url',
                  required: true,
                  pattern: '^https://',
                },
              ]}
              href="https://github.com/pjb0811/live-editor/releases"
              className="text-indigo-500 hover:underline"
            >
              All releases
            </a>
          </p>
        </div>
      </section>
    `,
  },
  {
    id: 'faq',
    name: 'FAQ',
    code: `
      <section data-name="FAQ" className="px-5 py-16">
        <div className="mx-auto max-w-3xl">
          <h2
            data-id=""
            data-binding={[{ label: 'Title', property: 'innerText' }]}
            className="mb-12 text-center text-4xl font-bold text-gray-800"
          >
            Frequently Asked Questions
          </h2>
          <div
            data-id=""
            data-binding={[{ label: 'FAQ Items', property: 'children' }]}
            className="divide-y divide-gray-200"
          >
            <details className="py-4">
              <summary
                data-id=""
                data-binding={[{ label: 'Question 1', property: 'innerText' }]}
                className="cursor-pointer text-lg font-semibold text-gray-800"
              >
                What is Live Editor?
              </summary>
              <p
                data-id=""
                data-binding={[{ label: 'Answer 1', type: 'richtext' }]}
                className="mt-3 text-gray-600"
              >
                Live Editor is an open-source tool for building web
                interfaces visually. It helps you learn web development by
                providing instant feedback as you build components.
              </p>
            </details>
            <details className="py-4">
              <summary
                data-id=""
                data-binding={[{ label: 'Question 2', property: 'innerText' }]}
                className="cursor-pointer text-lg font-semibold text-gray-800"
              >
                Do I need coding experience?
              </summary>
              <p
                data-id=""
                data-binding={[{ label: 'Answer 2', type: 'richtext' }]}
                className="mt-3 text-gray-600"
              >
                No! Live Editor is designed for all skill levels. Beginners
                can learn through visual editing, while experienced
                developers can work directly with code.
              </p>
            </details>
            <details className="py-4">
              <summary
                data-id=""
                data-binding={[{ label: 'Question 3', property: 'innerText' }]}
                className="cursor-pointer text-lg font-semibold text-gray-800"
              >
                Is it really free?
              </summary>
              <p
                data-id=""
                data-binding={[{ label: 'Answer 3', type: 'richtext' }]}
                className="mt-3 text-gray-600"
              >
                Yes, completely free! Live Editor is an open-source project
                with no hidden costs or premium tiers. All features are
                available to everyone.
              </p>
            </details>
            <details className="py-4">
              <summary
                data-id=""
                data-binding={[{ label: 'Question 4', property: 'innerText' }]}
                className="cursor-pointer text-lg font-semibold text-gray-800"
              >
                How can I contribute?
              </summary>
              <p
                data-id=""
                data-binding={[{ label: 'Answer 4', type: 'richtext' }]}
                className="mt-3 text-gray-600"
              >
                You can contribute by reporting bugs, suggesting features,
                sharing your projects, or contributing code. Check our
                GitHub repository for more details.
              </p>
            </details>
          </div>
        </div>
      </section>
    `,
  },
];
