interface Module {
  exports: {
    default?: React.ComponentType<Record<string, unknown>>;
  };
}

interface Section {
  id: string;
  name: string;
  code: string;
}
