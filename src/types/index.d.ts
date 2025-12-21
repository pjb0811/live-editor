export interface Module {
  exports: {
    default?: React.ComponentType<Record<string, unknown>>;
  };
}

export namespace Dnd {
  interface Section {
    id: string;
    name: string;
    code: string;
  }
}
