import type { Section } from '~/types';

// A palette section whose own `<section>` root carries a `data-binding`, so
// the panel can edit the section's background and vertical padding (#429).
// The shipped sections bind only the elements inside them: which properties
// of a section are editable, and what they're called, is the consumer's
// call, so this lives with the demos and the dev page, not in the library's
// default palette.
//
// The values sit in an inline `style` object rather than in `className` so
// they render wherever the section does, with or without a Tailwind build
// behind the preview frame.
export const SECTION_ROOT_EXAMPLE: Section = {
  id: 'banner',
  name: 'Banner (bound section)',
  code: `
      <section
        data-name="Banner"
        data-binding={[
          {
            label: 'Section Style',
            property: 'style',
            type: 'object',
            render: {
              backgroundColor: { type: 'color', label: 'Background' },
              paddingBlock: {
                type: 'number',
                label: 'Vertical Padding',
                min: 0,
                max: 160,
                widget: 'slider',
              },
            },
          },
        ]}
        style={{ backgroundColor: '#4f46e5', paddingBlock: 64 }}
      >
        <div className="mx-auto max-w-xl px-6 text-center text-white">
          <h2
            data-id=""
            data-binding={[{ label: 'Heading', property: 'innerText' }]}
            className="text-3xl font-bold"
          >
            Edit this section's own background
          </h2>
          <p
            data-id=""
            data-binding={[{ label: 'Text', property: 'innerText' }]}
            className="mt-3 text-indigo-100"
          >
            Its style is bound on the section itself, so it shows up in the panel ahead of the fields inside it.
          </p>
        </div>
      </section>
    `,
};
