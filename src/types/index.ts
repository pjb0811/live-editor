export interface Module {
  exports: {
    default?: React.ComponentType<Record<string, unknown>>;
  };
  error?: string;
}

export interface Section {
  id: string;
  name: string;
  code: string;
}
