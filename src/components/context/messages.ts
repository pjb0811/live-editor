import { createContext, useContext } from 'react';

import {
  type ValidationMessages,
  defaultValidationMessages,
} from '~/utils/ast/validate';

// Every piece of text the editor shows or announces, grouped by where it
// appears (#524). Text with values in it is a function, so a translation
// can put them where its grammar needs them. Pass a partial set to `Live`'s
// `messages` prop to replace any of it; the rest stays English.
export interface LiveMessages {
  // The section toolbar on the canvas and the panel header.
  section: {
    moveUp: string;
    moveDown: string;
    duplicate: string;
    delete: string;
  };
  canvas: {
    // The mobile palette button and Drawer title.
    palette: string;
    // The mobile panel Drawer title.
    properties: string;
    pickElement: string;
    pickElementActive: string;
    dropHere: string;
    dropAtBottom: string;
    empty: string;
    emptyHintTouch: string;
    emptyHintDrag: string;
    syntaxError: string;
    syntaxErrorDetail: string;
    missingContainer: (containerId: string) => string;
    missingContainerDetail: (containerId: string) => string;
    stale: string;
  };
  panel: {
    selectSection: string;
    noEditableElements: string;
    readOnly: string;
    expressionPreserved: string;
    useCodeEditor: string;
    invalidValue: string;
    urlPlaceholder: string;
    numberPlaceholder: string;
    textPlaceholder: string;
  };
  // The built-in editor for an array value.
  items: {
    heading: (count: number) => string;
    add: string;
    item: (position: number) => string;
    reorder: (item: string) => string;
    moveUp: string;
    moveDown: string;
    delete: string;
    collapseAll: string;
    expandAll: string;
    unreadable: string;
    empty: string;
    structureLocked: string;
    noNestedBindings: string;
  };
  // The built-in editor for child elements.
  children: {
    heading: (count: number) => string;
    add: string;
    child: (position: number, tagName: string) => string;
    moveUp: string;
    moveDown: string;
    delete: string;
    editableBindings: string;
    childNodes: string;
  };
  // The bar shown while items or children are selected.
  selection: {
    count: (count: number) => string;
    duplicate: string;
    moveUp: string;
    moveDown: string;
    delete: string;
    clear: string;
  };
  // The `title` and `description` of a `DndEditError`, which the default
  // toast shows.
  editErrors: {
    updateFailed: (label: string) => string;
    cannotEdit: (label: string) => string;
    cannotRemove: (label: string) => string;
    attributeNotFound: (property: string) => string;
    // `property` is set when the binding names one, otherwise `label` is the
    // one to show.
    bindingNotDeclared: (target: {
      label: string;
      property?: string;
    }) => string;
    duplicateBinding: (target: {
      count: number;
      label: string;
      property?: string;
    }) => string;
    reservedProperty: (property: string) => string;
    requiredProperty: (property: string) => string;
    noBinding: string;
    elementNotFound: string;
    unsupportedSyntax: (property: string) => string;
    selfClosing: (property: string) => string;
    checkConsole: string;
    syntaxError: string;
    syntaxErrorDetail: string;
    missingContainer: (containerId: string) => string;
    missingContainerDetail: (containerId: string) => string;
    sectionParseFailed: string;
    itemsParseFailed: string;
    itemUpdateFailed: string;
    itemUpdateFailedDetail: string;
  };
  // What a screen reader hears during a drag.
  announcements: {
    instructions: string;
    // Stands in for a section without a name.
    section: string;
    pickedUp: (name: string) => string;
    movedTo: (name: string, position: number, total: number) => string;
    notOver: (name: string) => string;
    droppedAt: (name: string, position: number, total: number) => string;
    dropped: (name: string) => string;
    cancelled: (name: string) => string;
    itemOver: (name: string, over: string) => string;
    itemMoved: (name: string, over: string) => string;
  };
  // The error boxes of `Live.Preview`, `Live.Error` and canvas sections.
  errors: {
    default: string;
    compile: string;
    runtime: string;
    rendering: string;
    sectionUnavailable: string;
    sectionNotRendered: string;
    tryAgain: string;
    // The message of a page error that carries none.
    unknown: string;
    // The message of an unhandled promise rejection that carries none.
    unhandledRejection: string;
  };
  validation: ValidationMessages;
}

// Every group of `LiveMessages`, each with any of its keys.
export type LiveMessagesInput = {
  [Group in keyof LiveMessages]?: Partial<LiveMessages[Group]>;
};

export const defaultMessages: LiveMessages = {
  section: {
    moveUp: 'Move section up',
    moveDown: 'Move section down',
    duplicate: 'Duplicate section',
    delete: 'Delete section',
  },
  canvas: {
    palette: 'Components',
    properties: 'Properties',
    pickElement: 'Pick an element',
    pickElementActive: 'Click an element to edit it. Esc to cancel.',
    dropHere: 'Drop here',
    dropAtBottom: 'Drag here to add at bottom',
    empty: 'No sections available',
    emptyHintTouch: 'Tap a component to add it',
    emptyHintDrag: 'Drag a component from the left to add it',
    syntaxError: 'The document has a syntax error',
    syntaxErrorDetail: 'Fix it in the code to see its sections',
    missingContainer: containerId =>
      `No #${containerId} element in the document`,
    missingContainerDetail: containerId =>
      `Sections go inside the element with id="${containerId}"`,
    stale:
      'Showing the last version that parsed. Fix the syntax error in the code to edit here again.',
  },
  panel: {
    selectSection: 'Please select a section.',
    noEditableElements: 'No editable elements.',
    readOnly:
      "The document has a syntax error. These fields are from the last version that parsed, and can't be edited until it parses again.",
    expressionPreserved:
      'This expression is preserved but is not editable here.',
    useCodeEditor: 'Use the code editor to change it.',
    invalidValue: 'Invalid value.',
    urlPlaceholder: 'https://example.com',
    numberPlaceholder: 'Enter a numeric value',
    textPlaceholder: 'Enter a value',
  },
  items: {
    heading: count => `Items (${count})`,
    add: 'Add Item',
    item: position => `Item ${position}`,
    reorder: item => `Reorder ${item}`,
    moveUp: 'Move item up',
    moveDown: 'Move item down',
    delete: 'Delete item',
    collapseAll: 'Collapse all',
    expandAll: 'Expand all',
    unreadable:
      'This value could not be read as a list. Edit it in the code editor.',
    empty:
      'No editable items. The panel copies an existing item rather than guessing the shape of a new one — add the first item in the code editor.',
    structureLocked:
      'Values remain editable, but moving, copying, adding, and deleting require a dense array without spreads or parenthesized top-level items. Use the code editor for those structural changes.',
    noNestedBindings: 'No JSX bindings found',
  },
  children: {
    heading: count => `Children Items (${count})`,
    add: 'Add Child',
    child: (position, tagName) => `Child ${position} (${tagName})`,
    moveUp: 'Move child up',
    moveDown: 'Move child down',
    delete: 'Delete child',
    editableBindings: 'Editable Bindings:',
    childNodes: 'Child Nodes:',
  },
  selection: {
    count: count => `${count} selected`,
    duplicate: 'Duplicate selected',
    moveUp: 'Move selected up',
    moveDown: 'Move selected down',
    delete: 'Delete selected',
    clear: 'Clear',
  },
  editErrors: {
    updateFailed: label => `Failed to update "${label}"`,
    cannotEdit: label => `Cannot edit "${label}" in the panel`,
    cannotRemove: label => `Cannot remove "${label}"`,
    attributeNotFound: property =>
      `This element has no "${property}" attribute — check the property in its data-binding.`,
    bindingNotDeclared: ({ label, property }) =>
      `No binding for ${
        property ? `property "${property}"` : `label "${label}"`
      } is declared on this element's data-binding.`,
    duplicateBinding: ({ count, label, property }) =>
      `${count} bindings share ${
        property ? `property "${property}"` : `label "${label}"`
      } on this element — remove the duplicate in its data-binding.`,
    reservedProperty: property =>
      `"${property}" is managed by the editor, so a binding can't change it.`,
    requiredProperty: property =>
      `"${property}" is marked required in its data-binding, so it can't be removed.`,
    noBinding: 'This element has no data-binding declaration.',
    elementNotFound: 'The target element could not be found in this section.',
    unsupportedSyntax: property =>
      `The "${property}" expression was preserved. Change it in the code editor instead.`,
    selfClosing: property =>
      `This element is self-closing, so it has no content for "${property}". Give it a closing tag in the code editor.`,
    checkConsole: 'Check the console for details.',
    syntaxError: 'The document has a syntax error',
    syntaxErrorDetail:
      'The canvas shows the last version that parsed. Fix the error in the code, then edit here again.',
    missingContainer: containerId =>
      `No #${containerId} element in the document`,
    missingContainerDetail: containerId =>
      `Sections are the <section> elements inside the element with id="${containerId}". Start from createDocument(), or set containerId to match your document.`,
    sectionParseFailed: 'Failed to parse this section',
    itemsParseFailed: 'Failed to parse items',
    itemUpdateFailed: 'Failed to update this item',
    itemUpdateFailedDetail:
      'The source was preserved. Structural edits require a dense array without spreads; use the code editor for unsupported syntax.',
  },
  announcements: {
    instructions:
      'On a palette item, press Enter to add it to the canvas. On a canvas section, press Enter to select it, the up and down arrow keys to go to the previous or next section, and Delete to remove it. Press Space to pick a section up, the arrow keys to move it, and Space or Enter to drop it. Press Escape to cancel.',
    section: 'section',
    pickedUp: name => `Picked up ${name}.`,
    movedTo: (name, position, total) =>
      `${name} moved to position ${position} of ${total}.`,
    notOver: name => `${name} is no longer over a position.`,
    droppedAt: (name, position, total) =>
      `${name} dropped at position ${position} of ${total}.`,
    dropped: name => `${name} dropped.`,
    cancelled: name => `Moving ${name} was cancelled.`,
    itemOver: (name, over) => `${name} is over ${over}.`,
    itemMoved: (name, over) => `${name} was moved to the place of ${over}.`,
  },
  errors: {
    default: 'An error occurred',
    compile: 'Compile Error',
    runtime: 'Runtime Error',
    rendering: 'Rendering Error',
    sectionUnavailable: 'Section Unavailable',
    sectionNotRendered: 'This section is not rendered in this editor.',
    tryAgain: 'Try Again',
    unknown: 'Unknown error',
    unhandledRejection: 'Unhandled promise rejection',
  },
  validation: defaultValidationMessages,
};

// `base` (the defaults, unless given) with each group's given keys on top.
export const mergeMessages = (
  input?: LiveMessagesInput,
  base: LiveMessages = defaultMessages,
): LiveMessages => {
  if (!input) {
    return base;
  }

  const merged = { ...base };

  for (const group of Object.keys(base) as (keyof LiveMessages)[]) {
    if (input[group]) {
      merged[group] = { ...base[group], ...input[group] } as never;
    }
  }

  return merged;
};

// The English defaults outside a provider, so an error box rendered on its
// own still has text.
export const MessagesContext = createContext<LiveMessages>(defaultMessages);

// The messages in effect: the provider's, merged over the defaults. A custom
// palette or panel can use it to show the same text as the built-in ones.
export const useLiveMessages = () => useContext(MessagesContext);
