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
    id: 'hero-card-section',
    name: 'Hero Card',
    code: `
      <section data-name="Hero Card">
        <div
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          data-id="card-root"
        >
          <p
            className="text-xs uppercase tracking-wide text-gray-500"
            data-id="card-badge"
            data-binding={[
              { label: 'Badge', property: 'innerText' },
            ]}
          >
            Featured
          </p>
          <h3
            className="mt-2 text-lg font-semibold text-gray-900"
            data-id="card-title"
            data-binding={[
              { label: 'Title', property: 'innerText' },
            ]}
          >
            Launch your next idea
          </h3>
          <p
            className="mt-2 text-sm text-gray-600"
            data-id="card-description"
            data-binding={[
              { label: 'Description', property: 'innerText' },
            ]}
          >
            Combine drag-and-drop with code to ship faster.
          </p>
          <div className="mt-4 flex gap-2">
            <ui.Button
              color="blue"
              data-id="card-primary-button"
              data-binding={[
                { label: 'Primary Label', property: 'innerText' },
              ]}
            >
              Get started
            </ui.Button>
            <ui.Button
              variant="ghost"
              data-id="card-secondary-button"
              data-binding={[
                { label: 'Secondary Label', property: 'innerText' },
              ]}
            >
              View docs
            </ui.Button>
          </div>
        </div>
      </section>
    `,
  },
  {
    id: 'user-profile-settings',
    name: 'User Profile Settings',
    code: `
      <section data-name="User Profile Settings">
        <ui.Card>
          <ui.Space
            orientation="vertical"
            size="large"
            className="w-full"
          >
            <div>
              <ui.Typography.Title
                level={3}
                data-id="settings-title"
                data-binding={[
                  { label: 'Title', property: 'innerText' },
                ]}
              >
                Account Settings
              </ui.Typography.Title>
              <ui.Typography.Text
                type="secondary"
                data-id="settings-subtitle"
                data-binding={[
                  {
                    label: 'Subtitle',
                    property: 'innerText',
                  },
                ]}
              >
                Manage your profile and preferences
              </ui.Typography.Text>
            </div>

            <ui.Space
              orientation="vertical"
              size="middle"
              className="w-full"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  <span
                    data-id="username-label"
                    data-binding={[
                      {
                        label: 'Username Label',
                        property: 'innerText',
                      },
                    ]}
                  >
                    Username
                  </span>
                </label>
                <ui.Input
                  placeholder="Enter your username"
                  data-id="username-input"
                  data-binding={[
                    {
                      label: 'Username Placeholder',
                      property: 'placeholder',
                    },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  <span
                    data-id="email-label"
                    data-binding={[
                      {
                        label: 'Email Label',
                        property: 'innerText',
                      },
                    ]}
                  >
                    Email Address
                  </span>
                </label>
                <ui.Input
                  type="email"
                  placeholder="your.email@example.com"
                  data-id="email-input"
                  data-binding={[
                    {
                      label: 'Email Placeholder',
                      property: 'placeholder',
                    },
                  ]}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4  gap-x-4">
                <div className="flex-1">
                  <p
                    className="text-sm font-medium text-gray-900"
                    data-id="notifications-title"
                    data-binding={[
                      {
                        label: 'Notifications Title',
                        property: 'innerText',
                      },
                    ]}
                  >
                    Email Notifications
                  </p>
                  <p
                    className="text-xs text-gray-500"
                    data-id="notifications-desc"
                    data-binding={[
                      {
                        label: 'Notifications Description',
                        property: 'innerText',
                      },
                    ]}
                  >
                    Receive updates about your account
                  </p>
                </div>
                <ui.Checkbox
                  defaultChecked
                  data-id="notifications-checkbox"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 gap-x-4">
                <div className="flex-1">
                  <p
                    className="text-sm font-medium text-gray-900"
                    data-id="marketing-title"
                    data-binding={[
                      {
                        label: 'Marketing Title',
                        property: 'innerText',
                      },
                    ]}
                  >
                    Marketing Emails
                  </p>
                  <p
                    className="text-xs text-gray-500"
                    data-id="marketing-desc"
                    data-binding={[
                      {
                        label: 'Marketing Description',
                        property: 'innerText',
                      },
                    ]}
                  >
                    Get tips and product updates
                  </p>
                </div>
                <ui.Checkbox data-id="marketing-checkbox" />
              </div>
            </ui.Space>

            <div className="flex justify-end gap-2 border-t pt-4">
              <ui.Button
                variant="ghost"
                data-id="cancel-button"
                data-binding={[
                  {
                    label: 'Cancel Button',
                    property: 'innerText',
                  },
                ]}
              >
                Cancel
              </ui.Button>
              <ui.Button
                color="blue"
                data-id="save-button"
                data-binding={[
                  {
                    label: 'Save Button',
                    property: 'innerText',
                  },
                ]}
              >
                Save Changes
              </ui.Button>
            </div>
          </ui.Space>
        </ui.Card>
      </section>
    `,
  },
];
